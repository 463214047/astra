package main

import (
	"encoding/hex"
	"net/http"
	"strings"
)

func handleScrape(store *peerStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeBencode(w, http.StatusMethodNotAllowed, failureReason("invalid request method"))
			return
		}

		q := r.URL.Query()
		hashes := map[string]bool{}

		for _, ih := range q["ih"] {
			if len(ih) == 40 && isHex(ih) {
				hashes[strings.ToLower(ih)] = true
			}
		}

		for _, ihBin := range q["info_hash"] {
			if len(ihBin) == 20 {
				hashes[strings.ToLower(hex.EncodeToString([]byte(ihBin)))] = true
			}
		}

		if len(hashes) == 0 {
			if singleHex := q.Get("info_hash"); len(singleHex) == 40 && isHex(singleHex) {
				hashes[strings.ToLower(singleHex)] = true
			}
		}

		if len(hashes) == 0 {
			writeBencode(w, http.StatusBadRequest, failureReason("no info_hash provided"))
			return
		}

		files := bencodeDict{}
		for ih := range hashes {
			complete, incomplete := store.stats(ih)
			files[ih] = bencodeDict{
				"complete":   bencodeInt(int64(complete)),
				"downloaded": bencodeInt(0),
				"incomplete": bencodeInt(int64(incomplete)),
				"name":       bencodeString(""),
			}
		}

		writeBencode(w, http.StatusOK, bencodeDict{"files": files}.encode())
	}
}
