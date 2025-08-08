package database

import (
	"fmt"
	"io/ioutil"
	"net"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"github.com/rs/zerolog/log"
)

type SSHTunnel struct {
	client     *ssh.Client
	localAddr  string
	remoteAddr string
	config     *ssh.ClientConfig
	mu         sync.RWMutex
	closed     bool
}

func NewSSHTunnel(sshHost, sshPort, sshUser, keyPath, localAddr, remoteAddr string) (*SSHTunnel, error) {
	config, err := createSSHConfig(sshUser, keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH config: %w", err)
	}
	
	tunnel := &SSHTunnel{
		localAddr:  localAddr,
		remoteAddr: remoteAddr,
		config:     config,
	}
	
	if err := tunnel.connect(sshHost, sshPort); err != nil {
		return nil, err
	}
	
	go tunnel.healthCheck()
	
	return tunnel, nil
}

func createSSHConfig(user, keyPath string) (*ssh.ClientConfig, error) {
	key, err := ioutil.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read SSH key file: %w", err)
	}
	
	signer, err := ssh.ParsePrivateKey(key)
	if err != nil {
		return nil, fmt.Errorf("failed to parse SSH private key: %w", err)
	}
	
	config := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(signer),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}
	
	return config, nil
}

func (tunnel *SSHTunnel) connect(sshHost, sshPort string) error {
	tunnel.mu.Lock()
	defer tunnel.mu.Unlock()
	
	if tunnel.closed {
		return fmt.Errorf("tunnel is closed")
	}
	
	address := net.JoinHostPort(sshHost, sshPort)
	client, err := ssh.Dial("tcp", address, tunnel.config)
	if err != nil {
		return fmt.Errorf("failed to connect to SSH server: %w", err)
	}
	
	if tunnel.client != nil {
		tunnel.client.Close()
	}
	
	tunnel.client = client
	
	go tunnel.handleTunnel()
	
	log.Info().
		Str("ssh_host", sshHost).
		Str("local_addr", tunnel.localAddr).
		Str("remote_addr", tunnel.remoteAddr).
		Msg("SSH tunnel established")
	
	return nil
}

func (tunnel *SSHTunnel) handleTunnel() {
	listener, err := net.Listen("tcp", tunnel.localAddr)
	if err != nil {
		log.Error().Err(err).Msg("Failed to start local listener")
		return
	}
	defer listener.Close()
	
	for {
		tunnel.mu.RLock()
		if tunnel.closed {
			tunnel.mu.RUnlock()
			break
		}
		client := tunnel.client
		tunnel.mu.RUnlock()
		
		if client == nil {
			time.Sleep(time.Second)
			continue
		}
		
		conn, err := listener.Accept()
		if err != nil {
			log.Error().Err(err).Msg("Failed to accept connection")
			continue
		}
		
		go tunnel.handleConnection(conn, client)
	}
}

func (tunnel *SSHTunnel) handleConnection(localConn net.Conn, sshClient *ssh.Client) {
	defer localConn.Close()
	
	remoteConn, err := sshClient.Dial("tcp", tunnel.remoteAddr)
	if err != nil {
		log.Error().Err(err).Msg("Failed to connect to remote address")
		return
	}
	defer remoteConn.Close()
	
	done := make(chan bool, 2)
	
	go func() {
		defer func() { done <- true }()
		copyData(localConn, remoteConn)
	}()
	
	go func() {
		defer func() { done <- true }()
		copyData(remoteConn, localConn)
	}()
	
	<-done
}

func copyData(dst, src net.Conn) {
	buffer := make([]byte, 32*1024)
	for {
		n, err := src.Read(buffer)
		if err != nil {
			return
		}
		
		_, err = dst.Write(buffer[:n])
		if err != nil {
			return
		}
	}
}

func (tunnel *SSHTunnel) healthCheck() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		tunnel.mu.RLock()
		if tunnel.closed {
			tunnel.mu.RUnlock()
			break
		}
		client := tunnel.client
		tunnel.mu.RUnlock()
		
		if client == nil {
			continue
		}
		
		_, _, err := client.SendRequest("keepalive@openssh.com", true, nil)
		if err != nil {
			log.Error().Err(err).Msg("SSH tunnel health check failed")
		}
	}
}

func (tunnel *SSHTunnel) Close() {
	tunnel.mu.Lock()
	defer tunnel.mu.Unlock()
	
	tunnel.closed = true
	
	if tunnel.client != nil {
		tunnel.client.Close()
		tunnel.client = nil
	}
	
	log.Info().Msg("SSH tunnel closed")
} 