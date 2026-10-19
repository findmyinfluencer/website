(function () {
  "use strict";

  // Creator profile page. Fetches <apiBase>/influencer-detail.php?slug=<slug>
  // and fills the data-field/data-creator-section hooks in index.html. This
  // page serves only from p/ — no dependency on website/js/main.js or
  // website/css, so escapeHtml and the local/production apiBase switch
  // below are local copies, not shared imports.
  //
  // from the current hostname so this page's API calls route correctly in
  // both dev and production without manually swapping a URL per
  // environment — same convention as website/js/main.js's apiBase.
  var isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  var apiBase = isLocalHost ? "http://localhost/api" : "https://api.findmyinfluencer.com";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  var main = document.getElementById("main-content");
  if (!main) return;

  function resolveSlug() {
    var fromQuery = new URLSearchParams(window.location.search).get("slug");
    if (fromQuery) return fromQuery;

    var pathParts = window.location.pathname.split("/").filter(Boolean);
    var last = pathParts[pathParts.length - 1];
    if (last && !/\.html$/.test(last) && last !== "profile") return last;

    var fallback = main.getAttribute("data-creator-source");
    if (fallback) {
      var match = /([^\/]+)\.json$/.exec(fallback);
      if (match) return match[1];
    }
    return "";
  }

  var slug = resolveSlug();
  var source = slug ? apiBase + "/influencer-detail.php?slug=" + encodeURIComponent(slug) : null;
  var loadingEl = document.querySelector("[data-creator-loading]");

  if (!source) {
    if (loadingEl) loadingEl.textContent = "No creator specified.";
    return;
  }

  var PLATFORM_ICON = {
    instagram: "fa-instagram",
    youtube: "fa-youtube",
    facebook: "fa-facebook",
    linkedin: "fa-linkedin-in",
    snapchat: "fa-snapchat",
    twitter: "fa-twitter",
    pinterest: "fa-pinterest"
  };

  // Category/budget/language/gender/age — profile-level facts from the
  // database (same filters.json ids as every other field on the site),
  // shown as a labeled "quick facts" strip in the hero banner in this
  // fixed order, one icon+label+value per fact. Every icon sits in a
  // fixed-size circular badge regardless of that icon's own natural glyph
  // size, so a visually "heavier" glyph never throws off alignment the way
  // it did as a plain inline icon. Any fact can be null for an older/
  // incomplete profile, so missing values are skipped rather than shown
  // empty — category comes from `categories[0]`, the rest are plain
  // string fields.
  var META_FACT_ORDER = ["category", "budget", "language", "gender", "age"];
  var META_FACT_ICON = {
    category: "fa-tag",
    budget: "fa-sack-dollar",
    language: "fa-globe",
    gender: "fa-venus-mars",
    age: "fa-cake-candles"
  };
  // 5-color set, one per fact, so each reads as a distinct accent instead
  // of every icon sharing one uniform violet circle.
  var META_FACT_COLOR = {
    category: "c-amber",
    budget: "c-emerald",
    language: "c-blue",
    gender: "c-pink",
    age: "c-violet"
  };
  var META_FACT_LABEL = {
    category: "Category",
    budget: "Budget",
    language: "Language",
    gender: "Gender",
    age: "Age"
  };
  function renderMetaChips(creator) {
    var values = {
      category: creator.categories && creator.categories[0] ? creator.categories[0].label : null,
      budget: creator.budget,
      language: creator.language,
      gender: creator.gender,
      age: creator.age
    };
    return META_FACT_ORDER
      .filter(function (key) { return values[key]; })
      .map(function (key) {
        return (
          '<div class="hero-fact">' +
            '<i class="fa-solid ' + META_FACT_ICON[key] + " " + META_FACT_COLOR[key] + '" aria-hidden="true"></i>' +
            '<div class="hero-fact-text">' +
              '<span class="hero-fact-label">' + META_FACT_LABEL[key] + '</span>' +
              '<span class="hero-fact-value">' + escapeHtml(values[key]) + '</span>' +
            '</div>' +
          '</div>'
        );
      })
      .join("");
  }

  function statChip(color, iconClass, iconLibrary, value, label) {
    return (
      '<div class="stat-tile ' + color + '">' +
        '<span class="stat-tile-icon"><i class="' + iconLibrary + " " + iconClass + '" aria-hidden="true"></i></span>' +
        '<span class="stat-tile-text"><strong>' + escapeHtml(value) + "</strong><span>" + escapeHtml(label) + "</span></span>" +
      "</div>"
    );
  }

  function renderAudienceRows(rows) {
    return (rows || [])
      .map(function (a) {
        return (
          '<div class="audience-row"><div class="audience-head"><span>' + escapeHtml(a.label) + "</span><span>" + a.value + '%</span></div>' +
          '<div class="audience-track"><div class="audience-fill" style="width:' + a.value + '%;"></div></div></div>'
        );
      })
      .join("");
  }

  var AUDIENCE_GROUP_LABEL = { gender: "Gender", age: "Age", city: "Cities" };

  // One card per connected platform — own stats, own audience breakdown.
  // A creator with no connected accounts gets an empty list here, and
  // render() below never shows the section at all (rather than an empty
  // "Platform Performance" heading with nothing under it).
  function renderPlatformCard(p) {
    var icon = PLATFORM_ICON[p.platform] || "fa-link";
    var stats =
      statChip("c-violet", icon, "fa-brands", p.followers, "Followers") +
      statChip("c-blue", "fa-images", "fa-solid", p.posts, "Posts") +
      statChip("c-pink", "fa-chart-line", "fa-solid", p.engagementRate, "Engagement Rate") +
      statChip("c-emerald", "fa-heart", "fa-solid", p.likes30d, "Likes (30d)");

    var audienceCols = ["gender", "age", "city"]
      .map(function (key) {
        var rows = p.audience && p.audience[key];
        if (!rows || !rows.length) return "";
        return (
          '<div class="platform-audience-col"><h4>' + AUDIENCE_GROUP_LABEL[key] + "</h4>" +
          '<div class="audience-grid">' + renderAudienceRows(rows) + "</div></div>"
        );
      })
      .join("");

    return (
      '<div class="platform-card p-' + escapeHtml(p.platform) + '">' +
        '<div class="platform-card-head">' +
          '<span class="social-icon"><i class="fa-brands ' + icon + '" aria-hidden="true"></i></span>' +
          "<div><h3>" + escapeHtml(p.label) + "</h3><span>" + escapeHtml(p.handle) + "</span></div>" +
          '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener" class="btn btn-sm platform-card-link">' +
            "View Profile" +
            '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>' +
          "</a>" +
        "</div>" +
        '<div class="stat-band">' + stats + "</div>" +
        (audienceCols ? '<div class="platform-audience">' + audienceCols + "</div>" : "") +
      "</div>"
    );
  }

  function renderPlatformCards(platforms) {
    return (platforms || []).map(renderPlatformCard).join("");
  }

  function renderContact(contact) {
    var emailRow = contact.email
      ? '<a class="contact-row" href="mailto:' + escapeHtml(contact.email) + '">'
      : '<div class="contact-row">';
    var emailRowClose = contact.email ? "</a>" : "</div>";

    return (
      emailRow + '<span class="contact-icon c-blue"><i class="fa-solid fa-envelope" aria-hidden="true"></i></span><div><h3>Email</h3><p>' +
      escapeHtml(contact.email || "N/A") +
      "</p></div>" + emailRowClose +
      '<div class="contact-row"><span class="contact-icon c-whatsapp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></span><div><h3>WhatsApp</h3><p>' +
      escapeHtml(contact.whatsapp || "N/A") +
      "</p></div></div>" +
      '<div class="contact-row"><span class="contact-icon c-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></span><div><h3>Location</h3><p>' +
      escapeHtml(contact.location) +
      "</p></div></div>"
    );
  }

  function showSection(name) {
    var el = document.querySelector('[data-creator-section="' + name + '"]');
    if (el) el.style.display = "";
  }

  function render(creator) {
    document.title = creator.name + " — Creator Profile — Find My Influencer";

    var avatarEl = document.querySelector('[data-field="avatar-initials"]');
    if (avatarEl) {
      avatarEl.textContent = creator.avatarInitials || "";
      var avatarWrap = avatarEl.closest("[data-avatar]");
      if (avatarWrap && creator.avatarTheme) avatarWrap.setAttribute("data-theme", creator.avatarTheme);
    }

    document.querySelector('[data-field="name"]').textContent = creator.name;
    document.querySelector('[data-field="bio"]').textContent = creator.bio;
    document.querySelector('[data-field="meta-chips"]').innerHTML = renderMetaChips(creator);
    var statusBadge = document.querySelector('[data-field="status-badge"]');
    if (statusBadge) {
      statusBadge.style.display = creator.status ? "" : "none";
      var statusText = statusBadge.querySelector('[data-field="status-text"]');
      if (statusText) statusText.textContent = creator.status || "";
    }
    showSection("profile");

    document.querySelector('[data-field="contact"]').innerHTML = renderContact(creator.contact);
    showSection("contact");

    // Hidden entirely (not shown with an empty list) when the creator has
    // no connected accounts — a profile with nothing connected shouldn't
    // show a "Platform Performance" heading over a blank panel.
    if (creator.platforms && creator.platforms.length) {
      document.querySelector('[data-field="platforms"]').innerHTML = renderPlatformCards(creator.platforms);
      showSection("platforms");
    }

    var copyrightEl = document.querySelector('[data-field="copyright"]');
    if (copyrightEl) {
      copyrightEl.textContent = "© " + new Date().getFullYear() + " findmyinfluencer. All rights reserved.";
    }

    if (loadingEl) loadingEl.style.display = "none";
  }

  fetch(source)
    .then(function (res) {
      if (!res.ok) throw new Error("Failed to load " + source);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      console.error(err);
      if (loadingEl) {
        loadingEl.textContent = "This creator profile couldn't be loaded right now. Please try again shortly.";
      }
    });
})();
