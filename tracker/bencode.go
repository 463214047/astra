package main

import (
	"bytes"
	"sort"
)

type bencodeValue interface {
	encode() []byte
}

type bencodeString string
type bencodeInt int64
type bencodeBytes []byte
type bencodeList []bencodeValue
type bencodeDict map[string]bencodeValue

func (s bencodeString) encode() []byte {
	out := []byte(itoa(int64(len(s))) + ":")
	out = append(out, []byte(s)...)
	return out
}

func (i bencodeInt) encode() []byte {
	return []byte("i" + itoa(int64(i)) + "e")
}

func (b bencodeBytes) encode() []byte {
	out := []byte{}
	out = append(out, []byte(itoa(int64(len(b)))+":")...)
	out = append(out, b...)
	return out
}

func (l bencodeList) encode() []byte {
	out := []byte{byte('l')}
	for _, v := range l {
		out = append(out, v.encode()...)
	}
	out = append(out, 'e')
	return out
}

func (d bencodeDict) encode() []byte {
	out := []byte{byte('d')}
	keys := make([]string, 0, len(d))
	for k := range d {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		out = append(out, bencodeString(k).encode()...)
		out = append(out, d[k].encode()...)
	}
	out = append(out, 'e')
	return out
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func failureReason(msg string) []byte {
	return bencodeDict{"failure reason": bencodeString(msg)}.encode()
}

func compactPeers(peers []*peerEntry, limit int) []byte {
	var buf bytes.Buffer
	count := 0
	for _, p := range peers {
		if count >= limit {
			break
		}
		octets := splitIPv4(p.ip)
		if len(octets) != 4 {
			continue
		}
		for _, o := range octets {
			buf.WriteByte(byte(o))
		}
		buf.WriteByte(byte((p.port >> 8) & 0xff))
		buf.WriteByte(byte(p.port & 0xff))
		count++
	}
	return buf.Bytes()
}

func splitIPv4(ip string) []int {
	parts := []int{}
	cur := 0
	for i := 0; i < len(ip); i++ {
		c := ip[i]
		if c == '.' {
			parts = append(parts, cur)
			cur = 0
		} else if c >= '0' && c <= '9' {
			cur = cur*10 + int(c-'0')
		} else {
			return nil
		}
	}
	parts = append(parts, cur)
	return parts
}
