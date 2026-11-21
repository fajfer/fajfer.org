module.exports = {
    author: "Damian Fajfer",
    authorUri: "https://fajfer.org",
    // Profiles elsewhere, emitted as schema.org "sameAs" on the about page.
    sameAs: [
        "https://github.com/fajfer",
        "https://gitlab.com/fajfer/",
        "https://www.linkedin.com/in/dfajfer/",
        "https://mastodon.social/@fajfer"
    ],
    languages: ["en", "pl"],
    languageLabels: {
        en: "English",
        pl: "Polski"
    },
    languageUris: {
        en: "http://dbpedia.org/resource/English_language",
        pl: "https://dbpedia.org/page/Polish_language"
    },
    title: {
        en: "fajfer.org",
        pl: "fajfer.org"
    },
    baseUrl: process.env.NODE_ENV === "development"
        ? "http://localhost:8085"
        : "https://blog.fajfer.org",
    keywords: {
        en: "devops, homelab, free software",
        pl: "devops, homelab, wolne oprogramowanie"
    }
};
