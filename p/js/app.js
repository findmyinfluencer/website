(function () {
  "use strict";

  // Public creator profile page. Content is rendered from
  // /api/influencer.php?slug=<slug>, backed by fmi_launch.influencer_profiles.
  // The slug comes from the pretty URL /p/<slug>/ (rewritten by .htaccess to
  // index.html?slug=<slug>), the raw query string, or the data-creator-source
  // attribute as a last-resort fallback for local testing.

  var escapeHtml = window.FMI.escapeHtml;

  var main = document.getElementById("main-content");
  if (!main) return;

  function resolveSlug() {
    var fromQuery = new URLSearchParams(window.location.search).get("slug");
    if (fromQuery) return fromQuery;

    var pathParts = window.location.pathname.split("/").filter(Boolean);
    var last = pathParts[pathParts.length - 1];
    if (last && last !== "index.html" && last !== "p") return last;

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

  function starsHtml(rating) {
    var html = "";
    for (var i = 1; i <= 5; i++) {
      if (rating >= i) {
        html += '<i class="fa-solid fa-star" aria-hidden="true"></i>';
      } else if (rating >= i - 0.5) {
        html += '<i class="fa-solid fa-star-half-stroke" aria-hidden="true"></i>';
      } else {
        html += '<i class="fa-regular fa-star" aria-hidden="true"></i>';
      }
    }
    return html;
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
        return '<span class="creator-tag c-' + escapeHtml(c.color) + '">' + escapeHtml(c.label) + "</span>";
      })
      .join("");
  }

  var STAT_COLORS = ["c-violet", "c-pink", "c-blue", "c-emerald"];

  function renderStats(stats) {
    return stats
      .map(function (s, i) {
        return (
          '<div class="stat-band-item ' + STAT_COLORS[i % STAT_COLORS.length] + '"><strong>' + escapeHtml(s.value) + "</strong><span>" + escapeHtml(s.label) + "</span></div>"
        );
      })
      .join("");
  }

  function renderContact(contact) {
    return (
      '<div class="quick-contact-card"><span class="value-icon c-blue"><i class="fa-solid fa-envelope" aria-hidden="true"></i></span><h3>Email</h3><p>' +
      escapeHtml(contact.email) +
      "</p></div>" +
      '<div class="quick-contact-card"><span class="value-icon c-whatsapp"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></span><h3>WhatsApp</h3><p>' +
      escapeHtml(contact.whatsapp) +
      "</p></div>" +
      '<div class="quick-contact-card"><span class="value-icon c-location"><i class="fa-solid fa-location-dot" aria-hidden="true"></i></span><h3>Location</h3><p>' +
      escapeHtml(contact.location) +
      "</p></div>"
    );
  }

  function renderSocial(social) {
    return social
      .map(function (s) {
        var icon = PLATFORM_ICON[s.platform] || "fa-link";
        return (
          '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener" class="creator-social-item p-' + escapeHtml(s.platform) + '">' +
            '<span class="creator-social-icon"><i class="fa-brands ' + icon + '" aria-hidden="true"></i></span>' +
            '<span class="creator-social-text"><span class="creator-social-name">' + escapeHtml(s.label) + '</span><span class="creator-social-meta">' + escapeHtml(s.meta) + "</span></span>" +
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
          '<div><div class="audience-item-head"><span>' + escapeHtml(a.label) + "</span><span>" + a.value + '%</span></div>' +
          '<div class="audience-bar-track"><div class="audience-bar-fill" style="width:' + a.value + '%;"></div></div></div>'
        );
      })
      .join("");
  }

  function renderTestimonial(review) {
    var initials = review.brand
      .split(" ")
      .map(function (w) { return w.charAt(0); })
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      '<div class="testimonial-card theme-' + escapeHtml(review.theme) + '" data-rating="' + Math.floor(review.rating) + '">' +
        '<div class="testimonial-stars">' + starsHtml(review.rating) + "</div>" +
        '<p class="testimonial-quote">"' + escapeHtml(review.text) + '"</p>' +
        '<div class="testimonial-person">' +
          '<span class="testimonial-avatar">' + escapeHtml(initials) + "</span>" +
          "<div><h3>" + escapeHtml(review.brand) + "</h3></div>" +
        "</div>" +
      "</div>"
    );
  }

  function showSection(name) {
    var el = document.querySelector('[data-creator-section="' + name + '"]');
    if (el) el.style.display = "";
  }

  function render(creator) {
    document.title = creator.name + " — Creator Profile — Find My Influencer";

    document.querySelector('[data-field="name"]').textContent = creator.name;
    document.querySelector('[data-field="city"]').textContent = " " + creator.city;
    document.querySelector('[data-field="handle"]').textContent = creator.handle;
    document.querySelector('[data-field="bio"]').textContent = creator.bio;
    document.querySelector('[data-field="tags"]').innerHTML = renderTags(creator.categories);
    var verifiedBadge = document.querySelector('[data-field="verified-badge"]');
    if (verifiedBadge && !creator.verified) {
      verifiedBadge.style.display = "none";
    }
    showSection("profile");

    document.querySelector('[data-field="stats"]').innerHTML = renderStats(creator.stats);
    showSection("stats");

    document.querySelector('[data-field="contact"]').innerHTML = renderContact(creator.contact);
    showSection("contact");

    document.querySelector('[data-field="social"]').innerHTML = renderSocial(creator.social);
    showSection("social");

    document.querySelector('[data-field="audience"]').innerHTML = renderAudience(creator.audience);
    showSection("audience");

    // var reviewCountText = creator.reviews.count + (creator.reviews.count === 1 ? " review" : " reviews");
    // document.querySelector('[data-field="reviews-count"]').textContent = reviewCountText;
    // document.querySelector('[data-field="modal-count"]').textContent = "(" + reviewCountText + ")";
    // document.querySelector('[data-field="reviews-preview"]').innerHTML = creator.reviews.items.slice(0, 3).map(renderTestimonial).join("");
    // document.querySelector('[data-field="reviews-all"]').innerHTML = creator.reviews.items.map(renderTestimonial).join("");
    // showSection("reviews");

    var firstName = creator.name.split(" ")[0];
    document.querySelector('[data-field="cta-text"]').textContent =
      "Send " + firstName + " a campaign invite and she'll typically respond within 24 hours.";

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
        loadingEl.textContent = "We couldn’t find the creator you’re looking for. Please check the url or search keyword and try again.";
      }
    });

  // ---- Reviews modal (open/close + filter by rating) ----
  var reviewsBackdrop = document.querySelector("[data-reviews-backdrop]");
  var reviewsPanel = document.querySelector("[data-reviews-panel]");
  var reviewsOpenBtn = document.querySelector("[data-reviews-open]");
  var reviewsCloseBtn = document.querySelector("[data-reviews-close]");
  var reviewFilters = document.querySelector("[data-review-filters]");
  var reviewsAllGrid = document.querySelector('[data-field="reviews-all"]');
  var reviewEmpty = document.querySelector("[data-review-empty]");

  function openReviewsModal() {
    reviewsBackdrop.classList.add("is-open");
    reviewsPanel.classList.add("is-open");
  }

  function closeReviewsModal() {
    reviewsBackdrop.classList.remove("is-open");
    reviewsPanel.classList.remove("is-open");
  }

  if (reviewsOpenBtn) reviewsOpenBtn.addEventListener("click", openReviewsModal);
  if (reviewsCloseBtn) reviewsCloseBtn.addEventListener("click", closeReviewsModal);
  if (reviewsBackdrop) reviewsBackdrop.addEventListener("click", closeReviewsModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeReviewsModal();
  });

  if (reviewFilters) {
    reviewFilters.addEventListener("click", function (e) {
      var chip = e.target.closest(".review-filter-chip");
      if (!chip) return;
      reviewFilters.querySelectorAll(".review-filter-chip").forEach(function (c) {
        c.classList.remove("is-active");
      });
      chip.classList.add("is-active");

      var filter = chip.getAttribute("data-filter");
      var visibleCount = 0;
      reviewsAllGrid.querySelectorAll(".testimonial-card").forEach(function (card) {
        var match = filter === "all" || card.getAttribute("data-rating") === filter;
        card.style.display = match ? "" : "none";
        if (match) visibleCount++;
      });
      reviewEmpty.style.display = visibleCount === 0 ? "block" : "none";
    });
  }
})();
