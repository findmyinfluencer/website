(function () {
  "use strict";

  // Fresh-design creator profile page (index-v2.html). Same data contract as
  // js/app.js (fetches /api/influencer.php?slug=<slug> and fills the same
  // data-field/data-creator-section hooks) — kept as its own file, rather
  // than editing the shared app.js, so this redesign can't affect the live
  // page. The one addition over app.js is avatar-initials rendering, which
  // this design uses and the original page doesn't.

  var escapeHtml = window.FMI.escapeHtml;

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
  var source = slug ? "/api/influencer.php?slug=" + encodeURIComponent(slug) : null;
  var loadingEl = document.querySelector("[data-creator-loading]");

  if (!source) {
    if (loadingEl) loadingEl.textContent = "No creator specified.";
    return;
  }

  var PLATFORM_ICON = {
    instagram: "fa-instagram",
    youtube: "fa-youtube",
    facebook: "fa-facebook",
    linkedin: "fa-linkedin-in"
  };

  function renderTags(categories) {
    return categories
      .map(function (c) {
        return '<span class="tag" data-color="' + escapeHtml(c.color) + '">' + escapeHtml(c.label) + "</span>";
      })
      .join("");
  }

  var STAT_COLORS = ["c-violet", "c-pink", "c-blue", "c-emerald"];
  var METRIC_ICON = {
    "Engagement Rate": "fa-chart-line",
    "Avg. Views": "fa-eye",
    "Campaigns Done": "fa-bullhorn"
  };

  // Social "meta" strings look like "<handle> · <followers>" — pull just
  // the trailing follower count back out for the stat tiles / social cards.
  function followersFromMeta(meta) {
    return meta.indexOf(" · ") > -1 ? meta.split(" · ").pop() : meta;
  }

  function statChip(color, iconClass, iconLibrary, value, label) {
    return (
      '<div class="stat-tile ' + color + '">' +
        '<span class="stat-tile-icon"><i class="' + iconLibrary + " " + iconClass + '" aria-hidden="true"></i></span>' +
        '<span class="stat-tile-text"><strong>' + escapeHtml(value) + "</strong><span>" + escapeHtml(label) + "</span></span>" +
      "</div>"
    );
  }

  // Followers now shown per-platform (one tile per connected social account,
  // using that account's own follower count) instead of one combined
  // "Followers" number — Engagement Rate / Avg. Views / Campaigns Done stay
  // as single overall tiles since the API doesn't track those per platform.
  function renderStats(creator) {
    var social = creator.social || [];

    var platformTiles = social
      .map(function (s, i) {
        var icon = PLATFORM_ICON[s.platform] || "fa-link";
        var followers = followersFromMeta(s.meta);
        return statChip(STAT_COLORS[i % STAT_COLORS.length], icon, "fa-brands", followers, s.label + " Followers");
      })
      .join("");

    var extraTiles = (creator.stats || [])
      .slice(1) // stats[0] is the old combined "Followers" tile — skip it
      .map(function (s, i) {
        var color = STAT_COLORS[(social.length + i) % STAT_COLORS.length];
        var icon = METRIC_ICON[s.label] || "fa-chart-simple";
        return statChip(color, icon, "fa-solid", s.value, s.label);
      })
      .join("");

    return platformTiles + extraTiles;
  }

  function renderContact(contact) {
    var emailRow = contact.email
      ? '<a class="contact-row" href="mailto:' + escapeHtml(contact.email) + '">'
      : '<div class="contact-row">';
    var emailRowClose = contact.email ? "</a>" : "</div>";

    return (
      emailRow + '<span class="contact-icon c-blue"><i class="fa-solid fa-envelope" aria-hidden="true"></i></span><div><h3>Email</h3><p>' +
      escapeHtml(contact.email) +
      "</p></div>" + emailRowClose +
      '<div class="contact-row"><span class="contact-icon c-whatsapp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></span><div><h3>WhatsApp</h3><p>' +
      escapeHtml(contact.whatsapp) +
      "</p></div></div>" +
      '<div class="contact-row"><span class="contact-icon c-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></span><div><h3>Location</h3><p>' +
      escapeHtml(contact.location) +
      "</p></div></div>"
    );
  }

  function renderSocial(social) {
    return social
      .map(function (s) {
        var icon = PLATFORM_ICON[s.platform] || "fa-link";
        return (
          '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener" class="social-card p-' + escapeHtml(s.platform) + '">' +
            '<span class="social-icon"><i class="fa-brands ' + icon + '" aria-hidden="true"></i></span>' +
            '<span class="social-text"><span class="social-name">' + escapeHtml(s.label) + '</span><span class="social-meta">' + escapeHtml(s.meta) + "</span></span>" +
            '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>' +
          "</a>"
        );
      })
      .join("");
  }

  function renderAudience(audience) {
    return audience
      .map(function (a) {
        return (
          '<div class="audience-row"><div class="audience-head"><span>' + escapeHtml(a.label) + "</span><span>" + a.value + '%</span></div>' +
          '<div class="audience-track"><div class="audience-fill" style="width:' + a.value + '%;"></div></div></div>'
        );
      })
      .join("");
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
    document.querySelector('[data-field="handle"]').textContent = creator.handle;
    document.querySelector('[data-field="bio"]').textContent = creator.bio;
    document.querySelector('[data-field="tags"]').innerHTML = renderTags(creator.categories);
    var verifiedBadge = document.querySelector('[data-field="verified-badge"]');
    if (verifiedBadge) verifiedBadge.style.display = creator.verified ? "" : "none";
    showSection("profile");

    document.querySelector('[data-field="stats"]').innerHTML = renderStats(creator);
    showSection("stats");

    document.querySelector('[data-field="contact"]').innerHTML = renderContact(creator.contact);
    var ctaBtn = document.querySelector("[data-cta-mailto]");
    if (ctaBtn) ctaBtn.href = creator.contact.email ? "mailto:" + creator.contact.email : "#";
    showSection("contact");

    document.querySelector('[data-field="social"]').innerHTML = renderSocial(creator.social);
    showSection("social");

    document.querySelector('[data-field="audience"]').innerHTML = renderAudience(creator.audience);
    showSection("audience");

    var firstName = creator.name.split(" ")[0];
    document.querySelector('[data-field="cta-text"]').textContent =
      "Send " + firstName + " a campaign invite and they'll typically respond within 24 hours.";

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
