// DOM Elements
const urlInput = document.getElementById('url-input');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const statusEl = document.getElementById('status');
const sentCountEl = document.getElementById('sent-count');
const failedCountEl = document.getElementById('failed-count');
const startTimeEl = document.getElementById('start-time');
const elapsedTimeEl = document.getElementById('elapsed-time');
const resultsContainer = document.getElementById('results-container');

// State
let isRunning = false;
let startTime = null;
let elapsedInterval = null;
let stats = {
    sent: 0,
    failed: 0,
    responseTimes: [],
    lastResponse: 0
};

// Utility Functions
function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

function updateStats() {
    sentCountEl.textContent = stats.sent;
    failedCountEl.textContent = stats.failed;
}

function formatElapsedTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function updateElapsedTime() {
    if (startTime) {
        const elapsed = Date.now() - startTime;
        elapsedTimeEl.textContent = formatElapsedTime(elapsed);
    }
}

function addResult(message, details, isError = false) {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${isError ? 'error' : ''}`;
    
    resultItem.innerHTML = `
        <div class="result-time">${formatTime()}</div>
        <div class="result-message ${isError ? 'error' : 'success'}">${message}</div>
        ${details ? `<div class="result-details">${details}</div>` : ''}
    `;
    
    resultsContainer.insertBefore(resultItem, resultsContainer.firstChild);
    
    // Keep only last 100 results
    while (resultsContainer.children.length > 100) {
        resultsContainer.removeChild(resultsContainer.lastChild);
    }
}

function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

async function ping(url) {
    stats.sent++;
    const seqNum = stats.sent;
    updateStats();
    
    const startTime = performance.now();
    
    try {
        // Use fetch with HEAD method for smallest possible request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(url, {
            method: 'HEAD',
            mode: 'no-cors', // Allow cross-origin requests
            cache: 'no-cache',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        stats.lastResponse = responseTime;
        stats.responseTimes.push(responseTime);
        
        // Keep only last 100 response times for average calculation
        if (stats.responseTimes.length > 100) {
            stats.responseTimes.shift();
        }
        
        updateStats();
        
        // Format like ping: Reply from URL: time=XXms
        addResult(
            `Reply from ${url}: time=${responseTime}ms`,
            null,
            false
        );
        
    } catch (error) {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        stats.failed++;
        stats.lastResponse = responseTime;
        updateStats();
        
        let errorMessage = 'Request timed out';
        if (error.name === 'AbortError') {
            errorMessage = 'Request timed out';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        addResult(
            errorMessage,
            null,
            true
        );
    }
}

async function startPing() {
    const url = urlInput.value.trim();
    
    if (!validateUrl(url)) {
        alert('Please enter a valid URL (e.g., https://example.com)');
        return;
    }
    
    // Update UI
    startBtn.disabled = true;
    stopBtn.disabled = false;
    urlInput.disabled = true;
    statusEl.textContent = 'Running';
    statusEl.style.color = 'var(--success-color)';
    
    // Set start time and begin elapsed timer
    startTime = Date.now();
    const now = new Date();
    startTimeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    elapsedTimeEl.textContent = '0s';
    
    // Update elapsed time every second
    elapsedInterval = setInterval(updateElapsedTime, 1000);
    
    isRunning = true;
    
    addResult(`Pinging ${url}:`, null, false);
    addResult('', null, false);
    
    // Continuously ping until stopped
    while (isRunning) {
        await ping(url);
        
        // Wait 1 second before next ping (like traditional ping)
        if (isRunning) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

function stopPing() {
    isRunning = false;
    
    // Stop elapsed timer
    if (elapsedInterval) {
        clearInterval(elapsedInterval);
        elapsedInterval = null;
    }
    
    // Update UI
    startBtn.disabled = false;
    stopBtn.disabled = true;
    urlInput.disabled = false;
    statusEl.textContent = 'Stopped';
    statusEl.style.color = 'var(--warning-color)';
    
    addResult('', null, false);
    addResult(`Ping statistics:`, null, false);
    const received = stats.sent - stats.failed;
    addResult(`    Packets: Sent = ${stats.sent}, Received = ${received}, Lost = ${stats.failed} (${stats.sent > 0 ? Math.round(stats.failed / stats.sent * 100) : 0}% loss)`, null, false);
    if (stats.responseTimes.length > 0) {
        const min = Math.min(...stats.responseTimes);
        const max = Math.max(...stats.responseTimes);
        const avg = Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length);
        addResult(`Approximate round trip times in milli-seconds:`, null, false);
        addResult(`    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`, null, false);
    }
}

function clearResults() {
    resultsContainer.innerHTML = '';
    stats = {
        sent: 0,
        failed: 0,
        responseTimes: [],
        lastResponse: 0
    };
    startTime = null;
    if (elapsedInterval) {
        clearInterval(elapsedInterval);
        elapsedInterval = null;
    }
    updateStats();
    startTimeEl.textContent = '--:--:--';
    elapsedTimeEl.textContent = '0s';
    statusEl.textContent = 'Idle';
    statusEl.style.color = 'var(--text-primary)';
}

// Event Listeners
startBtn.addEventListener('click', startPing);
stopBtn.addEventListener('click', stopPing);
clearBtn.addEventListener('click', clearResults);

// Allow Enter key to start ping
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !startBtn.disabled) {
        startPing();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    isRunning = false;
    if (elapsedInterval) {
        clearInterval(elapsedInterval);
    }
});
