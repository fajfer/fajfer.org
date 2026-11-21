// Builds schema.org JSON-LD (ProfilePage + Person) for the about pages
// from the same _data files the visible page is rendered from.
// Used as the `profileJsonLd` filter in .eleventy.js.

// Microsoft exam codes (AZ-305, PL-300, AB-731, ...) are stored in the
// certificates' "issuer" field; map them to the real issuer.
const EXAM_CODE = /^[A-Z]{2,3}-\d{3}$/;

const pick = (value, lang) =>
    value && typeof value === "object" ? value[lang] ?? value.en : value;

// Drop undefined/null/empty values so the output stays clean.
const compact = (obj) =>
    Object.fromEntries(
        Object.entries(obj).filter(
            ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
        )
    );

const organization = (name, url, type = "Organization") => compact({ "@type": type, name, url });

function credential(cert, tab) {
    const isExam = EXAM_CODE.test(cert.issuer);
    const [from, to] = String(cert.year || "").split(/\s*[-–]\s*/);
    return compact({
        "@type": "EducationalOccupationalCredential",
        name: cert.name,
        url: cert.url,
        credentialCategory: tab === "e-Learning" ? "course completion" : "certification",
        identifier: isExam ? cert.issuer : undefined,
        recognizedBy: organization(isExam ? "Microsoft" : cert.issuer),
        dateCreated: from,
        expires: to,
    });
}

module.exports = function profileJsonLd(ctx) {
    const { lang, site, url, title, description } = ctx;
    const abs = (path) => new URL(path, site.baseUrl).href;
    const personId = `${site.authorUri}/#person`;
    const [currentJob] = ctx.career.filter((job) => !job.end);

    const person = compact({
        "@type": "Person",
        "@id": personId,
        name: site.author,
        url: site.authorUri,
        image: abs("/img/damian.jpeg"),
        description,
        jobTitle: currentJob && pick(currentJob.title, lang),
        sameAs: site.sameAs,
        knowsAbout: [
            ...new Set([
                ...ctx.career.flatMap((j) => j.tags || []),
                ...ctx.certificates.map((g) => g.tab).filter((t) => t !== "e-Learning"),
            ]),
        ],
        worksFor: ctx.career.map((job) =>
            compact({
                "@type": "EmployeeRole",
                roleName: pick(job.title, lang),
                description: pick(job.description, lang),
                startDate: job.start,
                endDate: job.end,
                worksFor: organization(job.company, job.companyUrl),
            })
        ),
        alumniOf: ctx.education.map((edu) =>
            compact({
                "@type": "OrganizationRole",
                roleName: pick(edu.degree, lang),
                startDate: edu.start,
                endDate: edu.end,
                alumniOf: organization(edu.school, edu.schoolUrl, "EducationalOrganization"),
            })
        ),
        memberOf: [
            ...ctx.organizations.flatMap((group) =>
                group.items.map((org) =>
                    compact({
                        "@type": "OrganizationRole",
                        roleName: pick(org.role, lang),
                        memberOf: compact({
                            ...organization(pick(org.name, lang), org.url),
                            description: pick(org.description, lang),
                        }),
                    })
                )
            ),
            ...ctx.volunteer.map((pos) =>
                compact({
                    "@type": "OrganizationRole",
                    roleName: pick(pos.title, lang),
                    description: pick(pos.description, lang),
                    startDate: pos.start,
                    endDate: pos.end,
                    memberOf: organization(pos.organization, pos.organizationUrl),
                })
            ),
        ],
        hasCredential: ctx.certificates.flatMap((group) =>
            group.items.map((cert) => credential(cert, group.tab))
        ),
        performerIn: ctx.talks.map((talk) =>
            compact({
                "@type": "Event",
                name: pick(talk.title, lang),
                startDate: talk.date,
                superEvent: compact({ "@type": "Event", name: talk.event, url: talk.eventUrl }),
                subjectOf: [
                    talk.slidesUrl && { "@type": "PresentationDigitalDocument", url: talk.slidesUrl },
                    talk.videoUrl && { "@type": "VideoObject", url: talk.videoUrl },
                ].filter(Boolean),
            })
        ),
    });

    const page = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": abs(url),
        url: abs(url),
        name: `${site.author} – ${title}`,
        inLanguage: lang,
        mainEntity: person,
    };

    // Escape "<" so the JSON can never close the surrounding <script> tag.
    return JSON.stringify(page).replace(/</g, "\\u003c");
};
