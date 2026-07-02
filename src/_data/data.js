module.exports = {
    author: "Damian Fajfer",
    authorUri: "https://fajfer.org",
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
