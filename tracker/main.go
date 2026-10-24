package main

import (
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	if err := initDB(); err != nil {
		log.Fatalf("[tracker] DB 初始化失败: %v", err)
	}
	defer db.Close()

	store := newPeerStore()
	go runStatsWriter()

	mux := http.NewServeMux()
	mux.HandleFunc("/announce", handleAnnounce(store))
	mux.HandleFunc("/scrape", handleScrape(store))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	addr := os.Getenv("TRACKER_ADDR")
	if addr == "" {
		addr = ":6969"
	}

	server := &http.Server{
		Addr:         addr,
		Handler:      loggingMiddleware(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("[tracker] Astra PT Go Tracker → %s", addr)
	log.Printf("[tracker]   /announce  BEP-3")
	log.Printf("[tracker]   /scrape    BEP-48")
	log.Printf("[tracker]   /healthz   健康检查")

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("[tracker] 监听失败: %v", err)
	}
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func firstN(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if r.URL.Path == "/announce" {
			ih := firstN(r.URL.Query().Get("ih"), 12)
			if ih == "" {
				ih = "(binary)"
			}
			log.Printf("[tracker] %s %s ih=%s → %d (%s)",
				r.Method, r.URL.Path, ih, rw.status, time.Since(start))
		}
	})
}
