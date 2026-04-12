(function () {
    const measurementId = "G-JREZCESGEX";
    const hostname = window.location.hostname || "";
    const protocol = window.location.protocol || "";
    const isLocal =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "" ||
        protocol === "file:";

    if (!measurementId || isLocal) {
        return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
        page_path: window.location.pathname + window.location.search
    });
})();
