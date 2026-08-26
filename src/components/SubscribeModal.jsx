import React, { useState, useEffect } from 'react';

export default function SubscribeModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', msg: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Stop forever if already subscribed
        const isSubscribed = localStorage.getItem('has_subscribed');
        if (isSubscribed === 'true') return;

        let initialTimer = null;
        let intervalTimer = null;

        const startIntervals = () => {
            // First display: 20 seconds after scrolling
            initialTimer = setTimeout(() => {
                if (localStorage.getItem('has_subscribed') !== 'true') {
                    setIsOpen(true);
                }

                // Recurring interval: Every 1 minute until subscribed
                intervalTimer = setInterval(() => {
                    const subscribed = localStorage.getItem('has_subscribed') === 'true';
                    if (subscribed) {
                        clearInterval(intervalTimer);
                    } else {
                        setIsOpen(true);
                    }
                }, 60000); // 1 minute
            }, 20000); // 20 seconds
        };

        const handleInitialScroll = () => {
            startIntervals();
            window.removeEventListener('scroll', handleInitialScroll);
        };

        window.addEventListener('scroll', handleInitialScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleInitialScroll);
            if (initialTimer) clearTimeout(initialTimer);
            if (intervalTimer) clearInterval(intervalTimer);
        };
    }, []);

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', msg: '' });

        // Get raw env variable or fallback
        const rawEnvUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        // Strip trailing slashes and remove paths like '/api/jobs' if present
        let baseUrl = rawEnvUrl.replace(/\/api\/jobs\/?$/, '').replace(/\/+$/, '');

        try {
            const response = await fetch(`${baseUrl}/api/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            // Read response body
            const rawText = await response.text();
            let data = {};
            try {
                data = rawText ? JSON.parse(rawText) : {};
            } catch {
                throw new Error(`Server returned non-JSON response (Status ${response.status}).`);
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to subscribe.');
            }

            // Save subscription state permanently
            localStorage.setItem('has_subscribed', 'true');
            setStatus({ type: 'success', msg: data.message || 'Thank you for subscribing!' });

            setTimeout(() => {
                setIsOpen(false);
            }, 1800);

        } catch (err) {
            setStatus({ type: 'error', msg: err.message });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop">
            <div className="modal-card">

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="modal-close-btn"
                    aria-label="Close modal"
                    type="button"
                >
                    <svg
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Modal Header */}
                <div className="modal-header">
                    <div className="modal-icon-wrapper">
                        <svg
                            width="28"
                            height="28"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="modal-title">Stay Ahead with CurrenX</h3>
                    <p className="modal-subtitle">Get exclusive product updates, feature releases, and career opportunities sent straight to your inbox.</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="modal-input-container">
                        <input
                            type="email"
                            required
                            placeholder="Enter your email address..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="modal-input"
                        />
                    </div>

                    {status.msg && (
                        <p className={`modal-status-msg ${status.type === 'error' ? 'status-error' : 'status-success'}`}>
                            {status.msg}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="modal-submit-btn"
                    >
                        {loading ? 'Subscribing...' : 'Subscribe Now'}
                    </button>
                </form>

            </div>
        </div>
    );
}