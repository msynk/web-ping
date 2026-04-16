class WebPing {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.stats = {
            sent: 0,
            received: 0,
            lost: 0,
            times: []
        };
        this.timeout = 10000; // 10 seconds timeout
        this.interval = 500; // 1 second between pings
        
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.uriInput = document.getElementById('uriInput');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.outputSection = document.querySelector('.output-section');
        this.output = document.getElementById('output');
        this.sentCount = document.getElementById('sentCount');
        this.receivedCount = document.getElementById('receivedCount');
        this.lostCount = document.getElementById('lostCount');
        this.lossPercent = document.getElementById('lossPercent');
        this.minTime = document.getElementById('minTime');
        this.maxTime = document.getElementById('maxTime');
        this.avgTime = document.getElementById('avgTime');
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.clearBtn.addEventListener('click', () => this.clear());
        this.uriInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isRunning) {
                this.start();
            }
        });
    }

    validateUri(uri) {
        if (!uri || uri.trim() === '') {
            return false;
        }
        
        // Add protocol if missing
        if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
            uri = 'https://' + uri;
        }
        
        try {
            new URL(uri);
            return uri;
        } catch {
            return false;
        }
    }

    async ping(uri) {
        const startTime = performance.now();
        const timestamp = new Date().toLocaleTimeString();
        
        try {
            // Send the smallest possible request (HEAD request)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(uri, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            
            this.stats.received++;
            this.stats.times.push(duration);
            
            this.addOutputLine(
                `Reply from ${new URL(uri).hostname}: time=${duration}ms`,
                'ping-success'
            );
            
            this.updateStats();
            return { success: true, duration, status: response.status };
            
        } catch (error) {
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            
            this.stats.lost++;
            
            if (error.name === 'AbortError') {
                this.addOutputLine(
                    `Request timeout for ${new URL(uri).hostname} (timeout=${this.timeout}ms)`,
                    'ping-timeout'
                );
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                this.addOutputLine(
                    `Request failed for ${new URL(uri).hostname}: Network error`,
                    'ping-error'
                );
            } else {
                this.addOutputLine(
                    `Request failed for ${new URL(uri).hostname}: ${error.message}`,
                    'ping-error'
                );
            }
            
            this.updateStats();
            return { success: false, duration, error: error.message };
        }
    }

    async start() {
        const uri = this.validateUri(this.uriInput.value.trim());
        
        if (!uri) {
            alert('Please enter a valid URI');
            return;
        }
        
        this.isRunning = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.uriInput.disabled = true;
        
        this.addOutputLine(`Pinging ${new URL(uri).hostname}...`, 'ping-success');
        this.addOutputLine('', 'ping-success');
        
        // Start pinging
        await this.pingOnce(uri);
    }

    async pingOnce(uri) {
        if (!this.isRunning) return;
        
        this.stats.sent++;
        this.updateStats();
        
        await this.ping(uri);
        
        if (this.isRunning) {
            // Wait for the interval before next ping
            this.intervalId = setTimeout(() => {
                this.pingOnce(uri);
            }, this.interval);
        }
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.uriInput.disabled = false;
        
        this.addOutputLine('', 'ping-success');
        this.addOutputLine('Ping stopped.', 'ping-success');
        this.showSummary();
    }

    clear() {
        this.output.innerHTML = '';
        this.stats = {
            sent: 0,
            received: 0,
            lost: 0,
            times: []
        };
        this.updateStats();
    }

    addOutputLine(text, className = 'ping-success') {
        const line = document.createElement('div');
        line.className = `ping-line ${className}`;
        line.textContent = text;
        this.output.appendChild(line);
        this.outputSection.scrollTop = this.outputSection.scrollHeight;
        // this.output.scroll(0, this.output.scrollHeight);
    }

    updateStats() {
        this.sentCount.textContent = this.stats.sent;
        this.receivedCount.textContent = this.stats.received;
        this.lostCount.textContent = this.stats.lost;
        
        const lossPercent = this.stats.sent > 0 
            ? Math.round((this.stats.lost / this.stats.sent) * 100) 
            : 0;
        this.lossPercent.textContent = `${lossPercent}%`;
        
        if (this.stats.times.length > 0) {
            const times = this.stats.times;
            this.minTime.textContent = `${Math.min(...times)}ms`;
            this.maxTime.textContent = `${Math.max(...times)}ms`;
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            this.avgTime.textContent = `${avg}ms`;
        } else {
            this.minTime.textContent = '-';
            this.maxTime.textContent = '-';
            this.avgTime.textContent = '-';
        }
    }

    showSummary() {
        if (this.stats.sent === 0) return;
        
        const lossPercent = Math.round((this.stats.lost / this.stats.sent) * 100);
        const received = this.stats.received;
        const lost = this.stats.lost;
        const sent = this.stats.sent;
        
        let summaryText = `\nPing statistics:\n`;
        summaryText += `    Packets: Sent = ${sent}, Received = ${received}, Lost = ${lost} (${lossPercent}% loss)`;
        
        if (this.stats.times.length > 0) {
            const times = this.stats.times;
            const min = Math.min(...times);
            const max = Math.max(...times);
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            
            summaryText += `\nApproximate round trip times in milli-seconds:\n`;
            summaryText += `    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`;
        }
        
        this.addOutputLine(summaryText, 'ping-summary');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WebPing();
});
