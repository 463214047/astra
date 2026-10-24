package main

import (
	"sync"
	"time"
)

type peerEntry struct {
	ip       string
	port     uint16
	left     int64
	peerID   string
	email    string
	lastSeen time.Time
}

type peerStore struct {
	mu    sync.RWMutex
	peers map[string]map[string]*peerEntry
}

func newPeerStore() *peerStore {
	ps := &peerStore{
		peers: make(map[string]map[string]*peerEntry),
	}
	go ps.cleanupLoop()
	return ps
}

func (s *peerStore) peerKey(email, peerID string) string {
	return email + "|" + peerID
}

func (s *peerStore) upsert(infoHash, email, peerID, ip string, port uint16, left int64, event string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	peers, ok := s.peers[infoHash]
	if !ok {
		peers = make(map[string]*peerEntry)
		s.peers[infoHash] = peers
	}

	key := s.peerKey(email, peerID)
	if event == "stopped" {
		delete(peers, key)
		if len(peers) == 0 {
			delete(s.peers, infoHash)
		}
		return
	}

	peers[key] = &peerEntry{
		ip:       ip,
		port:     port,
		left:     left,
		peerID:   peerID,
		email:    email,
		lastSeen: time.Now(),
	}
}

func (s *peerStore) snapshot(infoHash string) []*peerEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	peers, ok := s.peers[infoHash]
	if !ok {
		return nil
	}
	out := make([]*peerEntry, 0, len(peers))
	for _, p := range peers {
		out = append(out, p)
	}
	return out
}

func (s *peerStore) stats(infoHash string) (complete, incomplete int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	peers, ok := s.peers[infoHash]
	if !ok {
		return 0, 0
	}
	for _, p := range peers {
		if p.left == 0 {
			complete++
		} else {
			incomplete++
		}
	}
	return
}

func (s *peerStore) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for ih, peers := range s.peers {
			for k, p := range peers {
				if now.Sub(p.lastSeen) > 15*time.Minute {
					delete(peers, k)
				}
			}
			if len(peers) == 0 {
				delete(s.peers, ih)
			}
		}
		s.mu.Unlock()
	}
}
