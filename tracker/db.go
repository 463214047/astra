package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

func initDB() error {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		return fmt.Errorf("DATABASE_URL 环境变量未设置")
	}

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("连接 PG 失败: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("PG ping 失败: %w", err)
	}

	log.Println("[tracker] PostgreSQL 已连接")
	return nil
}

func getUserByPasskey(passkey string) (string, error) {
	var email string
	err := db.QueryRow(
		`SELECT user_email FROM public.user_passkeys WHERE passkey = $1`,
		passkey,
	).Scan(&email)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return email, nil
}

func lookupTorrent(infoHash string) (string, error) {
	var postID string
	err := db.QueryRow(
		`SELECT post_id FROM public.torrent_whitelist WHERE info_hash = $1`,
		infoHash,
	).Scan(&postID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return postID, nil
}

type statsJob struct {
	email      string
	infoHash   string
	postID     string
	uploaded   int64
	downloaded int64
	isSeeding  bool
	isLeeching bool
	event      string
	seeds      int
	leeches    int
}

var jobCh = make(chan statsJob, 1024)

func runStatsWriter() {
	for job := range jobCh {
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[tracker] stats writer panic: %v", r)
				}
			}()

			if job.event != "stopped" {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()

				_, err := db.ExecContext(ctx,
					`INSERT INTO public.user_torrent_stats
					   (user_email, info_hash, uploaded, downloaded, is_seeding, is_leeching, last_announce)
					 VALUES ($1, $2, $3, $4, $5, $6, NOW())
					 ON CONFLICT (user_email, info_hash) DO UPDATE
					   SET uploaded     = public.user_torrent_stats.uploaded    + (EXCLUDED.uploaded    - public.user_torrent_stats.uploaded),
					       downloaded   = public.user_torrent_stats.downloaded  + (EXCLUDED.downloaded  - public.user_torrent_stats.downloaded),
					       is_seeding   = EXCLUDED.is_seeding,
					       is_leeching  = EXCLUDED.is_leeching,
					       last_announce = NOW()`,
					job.email, job.infoHash, job.uploaded, job.downloaded, job.isSeeding, job.isLeeching,
				)
				if err != nil {
					log.Printf("[tracker] user_torrent_stats upsert 失败: %v", err)
					return
				}
			}

			if job.postID != "" {
				ctx2, cancel2 := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel2()
				_, err := db.ExecContext(ctx2,
					`UPDATE public.posts SET seed_count = $1, leech_count = $2 WHERE id = $3`,
					job.seeds, job.leeches, job.postID,
				)
				if err != nil {
					log.Printf("[tracker] posts 更新 seed/leech 失败: %v", err)
				}
			}

			if job.event == "completed" {
				ctx3, cancel3 := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel3()
				_, err := db.ExecContext(ctx3,
					`UPDATE public.posts SET download_count = download_count + 1 WHERE id = $1`,
					job.postID,
				)
				if err != nil {
					log.Printf("[tracker] posts download_count 更新失败: %v", err)
				}
			}
		}()
	}
}

func submitStats(job statsJob) {
	select {
	case jobCh <- job:
	default:
		log.Printf("[tracker] stats job channel 满，丢弃 %s/%s", job.email, job.infoHash)
	}
}
