package main

import (
	"encoding/hex"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
)

func handleAnnounce(store *peerStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeBencode(w, http.StatusMethodNotAllowed, failureReason("invalid request method"))
			return
		}

		q := r.URL.Query()

		passkey := q.Get("passkey")
		peerID := q.Get("peer_id")
		portStr := q.Get("port")
		uploaded := parseInt64(q.Get("uploaded"), 0)
		downloaded := parseInt64(q.Get("downloaded"), 0)
		left := parseInt64(q.Get("left"), 0)
		event := q.Get("event")
		compact := parseInt(q.Get("compact"), 1)

		infoHashHex := ""
		if ihHex := q.Get("ih"); ihHex != "" {
			if len(ihHex) != 40 || !isHex(ihHex) {
				writeBencode(w, http.StatusBadRequest, failureReason("invalid info_hash (ih)"))
				return
			}
			infoHashHex = strings.ToLower(ihHex)
		} else if ihBin := q.Get("info_hash"); ihBin != "" {
			if len(ihBin) != 20 {
				writeBencode(w, http.StatusBadRequest, failureReason("invalid info_hash length"))
				return
			}
			infoHashHex = strings.ToLower(hex.EncodeToString([]byte(ihBin)))
		} else {
			writeBencode(w, http.StatusBadRequest, failureReason("missing info_hash"))
			return
		}

		if len(passkey) != 32 || !isHex(passkey) {
			writeBencode(w, http.StatusUnauthorized, failureReason("invalid passkey"))
			return
		}
		if peerID == "" {
			writeBencode(w, http.StatusBadRequest, failureReason("missing peer_id"))
			return
		}
		port := parseInt(portStr, 0)
		if port < 1 || port > 65535 {
			writeBencode(w, http.StatusBadRequest, failureReason("invalid port"))
			return
		}

		email, err := getUserByPasskey(strings.ToLower(passkey))
		if err != nil {
			log.Printf("[tracker] passkey 查询错误: %v", err)
			writeBencode(w, http.StatusInternalServerError, failureReason("internal error"))
			return
		}
		if email == "" {
			writeBencode(w, http.StatusUnauthorized, failureReason("invalid passkey"))
			return
		}

		postID, err := lookupTorrent(infoHashHex)
		if err != nil {
			log.Printf("[tracker] whitelist 查询错误: %v", err)
			writeBencode(w, http.StatusInternalServerError, failureReason("internal error"))
			return
		}
		if postID == "" {
			writeBencode(w, http.StatusNotFound, failureReason("torrent not registered"))
			return
		}

		ip := extractIP(r)
		store.upsert(infoHashHex, email, peerID, ip, uint16(port), left, event)
		seeds, leeches := store.stats(infoHashHex)

		if event != "stopped" {
			submitStats(statsJob{
				email:      email,
				infoHash:   infoHashHex,
				postID:     postID,
				uploaded:   uploaded,
				downloaded: downloaded,
				isSeeding:  left == 0,
				isLeeching: left > 0,
				event:      event,
				seeds:      seeds,
				leeches:    leeches,
			})
		} else {
			submitStats(statsJob{
				email:    email,
				infoHash: infoHashHex,
				postID:   postID,
				seeds:    seeds,
				leeches:  leeches,
				event:    event,
			})
		}

		snapshot := store.snapshot(infoHashHex)
		resp := bencodeDict{
			"interval":   bencodeInt(300),
			"complete":   bencodeInt(int64(seeds)),
			"incomplete": bencodeInt(int64(leeches)),
			"tracker id": bencodeString("astra-pt-go"),
		}

		if compact == 1 {
			resp["peers"] = bencodeBytes(compactPeers(snapshot, 200))
		} else {
			resp["peers"] = bencodeList{}
		}

		writeBencode(w, http.StatusOK, resp.encode())
	}
}

func extractIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.Split(fwd, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func parseInt(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

func parseInt64(s string, def int64) int64 {
	if s == "" {
		return def
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return def
	}
	return n
}

func isHex(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func writeBencode(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	w.Write(body)
}
