// Explicit, one-time handoff between same-origin tool windows. Text stays in memory.
export function sendTextToAnonymizer(text, report) {
    if (!text.trim()) return;
    const token = crypto.randomUUID();
    let target;
    let timer;
    const cleanup = () => {
        window.removeEventListener('message', receive);
        window.removeEventListener('pagehide', cleanup);
        clearTimeout(timer);
        text = '';
    };
    const receive = event => {
        if (event.origin !== location.origin || event.source !== target || event.data?.token !== token) return;
        if (event.data.type === 'text-transfer-ready') {
            target.postMessage({ type: 'text-transfer', token, text }, location.origin);
        } else if (event.data.type === 'text-transfer-complete') {
            report('Text opened in Anonymizer. Anonymize it and review the result.', 'good');
            cleanup();
        }
    };
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', cleanup, { once: true });
    target = window.open(`/anonymizer#transfer=${token}`, '_blank');
    if (!target) {
        cleanup();
        report('Allow this tool to open a tab, or copy the text and open Anonymizer yourself.', 'warning');
        return;
    }
    timer = setTimeout(() => {
        cleanup();
        report('The text handoff timed out. Keep this tab open and try again, or copy the text.', 'warning');
    }, 30000);
}

export function receiveToolText(accept) {
    const token = new URLSearchParams(location.hash.slice(1)).get('transfer');
    if (!token || !window.opener) return;
    const source = window.opener;
    const cleanup = () => {
        window.removeEventListener('message', receive);
        clearTimeout(timer);
    };
    const receive = event => {
        if (event.origin !== location.origin || event.source !== source || event.data?.token !== token || event.data?.type !== 'text-transfer' || typeof event.data.text !== 'string') return;
        accept(event.data.text);
        source.postMessage({ type: 'text-transfer-complete', token }, location.origin);
        history.replaceState(null, '', location.pathname + location.search);
        window.opener = null;
        cleanup();
    };
    const timer = setTimeout(cleanup, 30000);
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', cleanup, { once: true });
    source.postMessage({ type: 'text-transfer-ready', token }, location.origin);
}
