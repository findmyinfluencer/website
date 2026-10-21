(function () {
  "use strict";

  // The PHP API is hosted separately from this static site. Auto-detected
  // from the current hostname so every page's API calls route correctly in
  // both dev and production without manually swapping a URL per
  // environment — this is the ONE place that needs updating per
  // environment, kept at the very top of the file for that reason.
  var isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  var apiBase = isLocalHost ? "http://localhost/api" : "https://api.findmyinfluencer.com";

  // Influencer card color, assigned by each card's position in the list and
  // repeating every 10 — not read from the database (profiles no longer has
  // a theme column). Matches the 10 .theme-* rules in css/pages.css and, for
  // the profile detail page, api/influencer-detail.php's per-id equivalent.
  var INFLUENCER_THEMES = ["blue", "peach", "pink", "purple", "green", "teal", "coral", "indigo", "amber", "cyan"];
  function influencerTheme(index) {
    return "theme-" + INFLUENCER_THEMES[index % INFLUENCER_THEMES.length];
  }

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav-main");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Header shadow on scroll
  var header = document.querySelector(".site-header");
  if (header) {
    window.addEventListener("scroll", function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    });
  }

  // Password show/hide toggle (login1, signup1, reset-password) — safe to
  // run unconditionally, querySelectorAll just returns nothing on pages
  // without one.
  document.querySelectorAll(".password-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-target"));
      var isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.querySelector("i").className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });

  // Animated counters (hero stats + phone-card stats)
  var counters = document.querySelectorAll("[data-counter]");

  function animateCounter(el) {
    var raw = el.getAttribute("data-counter");
    var match = raw.match(/^([\d,]*\.?\d+)(.*)$/);
    if (!match) return;

    var numStr = match[1];
    var suffix = match[2];
    var end = parseFloat(numStr.replace(/,/g, ""));
    var decimals = numStr.indexOf(".") > -1 ? numStr.split(".")[1].length : 0;
    var useCommas = numStr.indexOf(",") > -1;
    var duration = 1400;
    var start = null;

    function frame(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = end * eased;
      var text = value.toFixed(decimals);
      if (useCommas) text = Number(text).toLocaleString("en-IN");
      el.textContent = text + suffix;

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = raw;
      }
    }

    window.requestAnimationFrame(frame);
  }

  if (counters.length) {
    if ("IntersectionObserver" in window) {
      var counterObserver = new IntersectionObserver(
        function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      counters.forEach(function (el) {
        counterObserver.observe(el);
      });
    } else {
      counters.forEach(animateCounter);
    }
  }

  // Shared render helpers. Exposed on window.FMI (below) so page-specific
  // inline scripts can reuse them without duplicating this code per page.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderFromJson(selector, render, onRendered) {
    var grid = document.querySelector(selector);
    if (!grid) return;

    var src = grid.getAttribute("data-source");
    if (!src) return;

    fetch(src)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + src);
        return res.json();
      })
      .then(function (items) {
        if (grid.hasAttribute("data-reverse")) {
          items = items.slice().reverse();
        }

        var exclude = (grid.getAttribute("data-exclude") || "")
          .split(",")
          .map(function (s) { return s.trim(); })
          .filter(Boolean);
        if (exclude.length) {
          items = items.filter(function (item) { return exclude.indexOf(item.slug) === -1; });
        }

        var limit = parseInt(grid.getAttribute("data-limit") || "", 10);
        if (!isNaN(limit)) {
          items = grid.hasAttribute("data-tail") ? items.slice(-limit) : items.slice(0, limit);
        }

        grid.innerHTML = items.map(function (item) { return render(item, grid); }).join("");
        if (typeof onRendered === "function") onRendered(grid, items);
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  // Shared helpers used by page-specific inline <script> blocks (see
  // index.html, find-influencer.html, campaigns.html, blog.html and every
  // blog/*.html post).
  window.FMI = {
    escapeHtml: escapeHtml,
    renderFromJson: renderFromJson,
    apiBase: apiBase
  };

  // Blog post grid: blog.html (the full listing, with pagination) and every
  // blog/*.html post (a capped "related posts" widget, via data-limit) share
  // the same .blog-grid markup and card template — distinguished by whether
  // the pagination nav exists on the page, since only blog.html has one.
  (function () {
    var BLOG_PAGE_SIZE = 15;

    function renderBlogCard(post, grid) {
      var base = grid.getAttribute("data-base") || "";
      var iconColor = post.theme.replace("theme-", "c-");
      return (
        '<a class="blog-card" href="' + escapeHtml(base + post.slug) + '">' +
          '<div class="blog-card-body">' +
            '<div class="blog-card-top">' +
              '<span class="blog-card-icon ' + escapeHtml(iconColor) + '"><i class="fa-solid ' + escapeHtml(post.icon) + '" aria-hidden="true"></i></span>' +
              '<span class="blog-card-tag">' + escapeHtml(post.category) + "</span>" +
            "</div>" +
            "<h3>" + escapeHtml(post.title) + "</h3>" +
            "<p>" + escapeHtml(post.excerpt) + "</p>" +
            '<div class="blog-card-meta">' +
              '<span class="author-initials">' + escapeHtml(post.authorInitials) + "</span>" +
              "<span>" + escapeHtml(post.author) + "</span>" +
              "<span>·</span>" +
              "<span>" + escapeHtml(post.date) + "</span>" +
              "<span>·</span>" +
              "<span>" + escapeHtml(post.readTime) + "</span>" +
            "</div>" +
          "</div>" +
        "</a>"
      );
    }

    function initBlogListing(grid) {
      var resultsCount = document.getElementById("blogResultsCount");
      var pagination = document.getElementById("blogPagination");
      var currentPage = 1;

      function renderPagination(page, totalPages, total) {
        if (!pagination) return;

        if (total <= 0) {
          pagination.innerHTML = "";
          return;
        }

        var rangeStart = (page - 1) * BLOG_PAGE_SIZE + 1;
        var rangeEnd = Math.min(page * BLOG_PAGE_SIZE, total);

        pagination.innerHTML =
          '<button type="button" class="page-nav-btn" data-page="' + (page - 1) + '"' + (page === 1 ? " disabled" : "") + '>' +
            '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i><span class="visually-hidden">Previous page</span>' +
          "</button>" +
          '<span class="page-range">' + rangeStart + " - " + rangeEnd + "</span>" +
          '<button type="button" class="page-nav-btn" data-page="' + (page + 1) + '"' + (page === totalPages ? " disabled" : "") + '>' +
            '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i><span class="visually-hidden">Next page</span>' +
          "</button>";
      }

      function render() {
        var all = Array.prototype.slice.call(grid.querySelectorAll(".blog-card"));
        var total = all.length;
        var totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;

        var rangeStart = (currentPage - 1) * BLOG_PAGE_SIZE;
        var rangeEnd = rangeStart + BLOG_PAGE_SIZE;
        all.forEach(function (card, index) {
          card.classList.toggle("is-hidden", index < rangeStart || index >= rangeEnd);
        });

        if (resultsCount) {
          resultsCount.innerHTML = "<strong>" + total + "</strong> blog" + (total === 1 ? "" : "s") + " found";
        }
        renderPagination(currentPage, totalPages, total);
      }

      if (pagination) {
        pagination.addEventListener("click", function (e) {
          var btn = e.target.closest(".page-nav-btn");
          if (!btn || btn.disabled) return;
          var page = parseInt(btn.getAttribute("data-page"), 10);
          if (!page || page === currentPage) return;
          currentPage = page;
          render();
        });
      }

      render();
    }

    if (document.getElementById("blogPagination")) {
      renderFromJson(".blog-grid", renderBlogCard, initBlogListing);
    } else {
      renderFromJson(".blog-grid", renderBlogCard);
    }
  })();

  // Nearest ancestor that actually clips/scrolls its content — the real
  // visible boundary a dropdown panel has to fit inside, as opposed to the
  // full window (which the filters side panel's own scroll area is well
  // short of). Falls back to the viewport when nothing scrolls.
  function nearestScrollParent(el) {
    var node = el.parentElement;
    while (node && node !== document.body) {
      var overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return node;
      node = node.parentElement;
    }
    return null;
  }

  // Multiselect dropdown used by every find-influencer.html filter — a
  // button (styled like a <select>) that opens a checkbox list, so each
  // filter can take several values instead of just one. Shared here (rather
  // than nested in initFindInfluencerPage) in case another page grows the
  // same kind of filter later.
  function createMultiSelect(root) {
    var trigger = root.querySelector(".ms-trigger");
    var triggerLabel = root.querySelector(".ms-trigger-label");
    var panel = root.querySelector(".ms-panel");
    var placeholder = root.getAttribute("data-placeholder") || "";
    var labels = {};

    function updateLabel() {
      var checked = panel.querySelectorAll("input:checked");
      root.classList.toggle("has-selection", checked.length > 0);
      if (checked.length === 0) {
        triggerLabel.textContent = placeholder;
      } else if (checked.length === 1) {
        triggerLabel.textContent = labels[checked[0].value] || placeholder;
      } else {
        triggerLabel.textContent = checked.length + " selected";
      }
    }

    // Sorted alphabetically by default — purely how the checkbox list reads,
    // never the stored id, so it doesn't touch filtering/sorting of results.
    // Pass sortAlphabetically: false for a filter whose filters.json order
    // is already meaningful (a range/progression, not just a name list).
    function populate(idToLabel, sortAlphabetically) {
      var current = {};
      panel.querySelectorAll("input:checked").forEach(function (cb) { current[cb.value] = true; });

      labels = idToLabel || {};
      var ids = Object.keys(labels);
      if (sortAlphabetically !== false) {
        ids.sort(function (a, b) { return labels[a].localeCompare(labels[b]); });
      }
      panel.innerHTML = ids.map(function (id) {
        return (
          '<label class="ms-option">' +
            '<input type="checkbox" value="' + escapeHtml(id) + '"' + (current[id] ? " checked" : "") + ">" +
            "<span>" + escapeHtml(labels[id]) + "</span>" +
          "</label>"
        );
      }).join("");
      updateLabel();
    }

    function getValues() {
      return Array.prototype.map.call(panel.querySelectorAll("input:checked"), function (cb) { return cb.value; });
    }

    function getSelectedEntries() {
      return Array.prototype.map.call(panel.querySelectorAll("input:checked"), function (cb) {
        return { id: cb.value, label: labels[cb.value] || cb.value };
      });
    }

    function setValues(ids) {
      var wanted = {};
      (ids || []).forEach(function (id) { wanted[id] = true; });
      panel.querySelectorAll("input").forEach(function (cb) { cb.checked = !!wanted[cb.value]; });
      updateLabel();
    }

    function removeValue(id) {
      var cb = panel.querySelector('input[value="' + id + '"]');
      if (cb) {
        cb.checked = false;
        updateLabel();
      }
    }

    panel.addEventListener("change", updateLabel);
    // Checking an option bubbles a click up to the document — without this,
    // the global "click outside closes every open dropdown" listener below
    // would close the panel after every single checkbox, not just on an
    // actual outside click.
    panel.addEventListener("click", function (e) { e.stopPropagation(); });

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var willOpen = !root.classList.contains("is-open");
      document.querySelectorAll(".ms-select.is-open").forEach(function (el) {
        el.classList.remove("is-open", "opens-up");
        el.querySelector(".ms-trigger").setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        // Flip the panel to open upward when there isn't enough room below
        // the trigger to fit it — otherwise a filter near the bottom of a
        // scrollable list (e.g. the filters side panel) opens its options
        // past the visible area, forcing extra scrolling just to see them.
        var scrollParent = nearestScrollParent(trigger);
        var bound = scrollParent ? scrollParent.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        var triggerRect = trigger.getBoundingClientRect();
        var spaceBelow = bound.bottom - triggerRect.bottom;
        var spaceAbove = triggerRect.top - bound.top;
        // scrollHeight is 0 on a display:none element, so the panel has to
        // be measured with display briefly forced on — synchronous, before
        // the next paint, so nothing actually flashes on screen.
        panel.style.display = "flex";
        var panelHeight = Math.min(panel.scrollHeight, 260); // 260 = .ms-panel's max-height
        panel.style.display = "";
        if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
          root.classList.add("opens-up");
        }
        root.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });

    return {
      populate: populate,
      getValues: getValues,
      getSelectedEntries: getSelectedEntries,
      setValues: setValues,
      removeValue: removeValue,
      clear: function () { setValues([]); }
    };
  }

  document.addEventListener("click", function () {
    document.querySelectorAll(".ms-select.is-open").forEach(function (el) {
      el.classList.remove("is-open", "opens-up");
      el.querySelector(".ms-trigger").setAttribute("aria-expanded", "false");
    });
  });

  // Find Influencer page: live search + filters over the API, with a
  // free-signup card always pinned to the end of the results.
  (function initFindInfluencerPage() {
    var grid = document.getElementById("findResultsGrid");
    if (!grid) return;

    var searchInput = document.getElementById("filterSearch");
    var filters = {
      category: createMultiSelect(document.getElementById("msCategory")),
      platform: createMultiSelect(document.getElementById("msPlatform")),
      city: createMultiSelect(document.getElementById("msCity")),
      state: createMultiSelect(document.getElementById("msState")),
      language: createMultiSelect(document.getElementById("msLanguage")),
      followers: createMultiSelect(document.getElementById("msFollowers")),
      status: createMultiSelect(document.getElementById("msStatus")),
      gender: createMultiSelect(document.getElementById("msGender")),
      age: createMultiSelect(document.getElementById("msAge")),
      budget: createMultiSelect(document.getElementById("msBudget"))
    };
    var clearBtn = document.getElementById("clearFilters");
    var resultsCount = document.getElementById("resultsCount");
    var pagination = document.getElementById("findPagination");

    // Filters side panel — see js/main.js's createMultiSelect comment and
    // find-influencer.html: every multiselect lives inside this panel so
    // the main page stays to a search box + a single "Filters" button, with
    // a row of removable chips showing whatever's actually applied.
    var openFiltersBtn = document.getElementById("openFiltersBtn");
    var closeFiltersBtn = document.getElementById("closeFiltersBtn");
    var filtersOverlay = document.getElementById("filtersOverlay");
    var filtersPanel = document.getElementById("filtersPanel");
    var filtersCountBadge = document.getElementById("filtersCountBadge");
    var panelApplyBtn = document.getElementById("panelApplyFilters");
    var panelClearBtn = document.getElementById("panelClearFilters");
    var activeFilterChips = document.getElementById("activeFilterChips");
    var appliedValues = {};

    function snapshotFilters() {
      var snap = {};
      Object.keys(filters).forEach(function (key) { snap[key] = filters[key].getValues(); });
      return snap;
    }

    function restoreFilters(snap) {
      Object.keys(filters).forEach(function (key) { filters[key].setValues(snap[key] || []); });
    }

    function updateFilterSummary() {
      var count = 0;
      var chipsHtml = "";
      Object.keys(filters).forEach(function (key) {
        filters[key].getSelectedEntries().forEach(function (entry) {
          count++;
          chipsHtml +=
            '<span class="filter-chip" data-filter-key="' + key + '" data-filter-id="' + escapeHtml(entry.id) + '">' +
              escapeHtml(entry.label) +
              '<button type="button" aria-label="Remove ' + escapeHtml(entry.label) + ' filter"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
            "</span>";
        });
      });

      if (filtersCountBadge) {
        filtersCountBadge.hidden = count === 0;
        filtersCountBadge.textContent = count;
      }
      if (activeFilterChips) {
        activeFilterChips.innerHTML = chipsHtml;
        activeFilterChips.hidden = count === 0;
      }
    }

    function openFiltersPanel() {
      if (!filtersPanel || !filtersOverlay) return;
      filtersOverlay.hidden = false;
      filtersPanel.setAttribute("aria-hidden", "false");
      // Rendering hidden -> visible first, then adding the "open" class on
      // the next frame, is what makes the slide-in/fade-in actually
      // transition instead of snapping straight to its end state.
      requestAnimationFrame(function () {
        filtersOverlay.classList.add("is-open");
        filtersPanel.classList.add("is-open");
      });
      if (openFiltersBtn) openFiltersBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }

    function closeFiltersPanel(discardPending) {
      if (!filtersPanel || !filtersOverlay) return;
      if (discardPending) restoreFilters(appliedValues);
      filtersOverlay.classList.remove("is-open");
      filtersPanel.classList.remove("is-open");
      if (openFiltersBtn) openFiltersBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      setTimeout(function () {
        filtersOverlay.hidden = true;
        filtersPanel.setAttribute("aria-hidden", "true");
      }, 250); // matches the CSS transition duration
    }

    function renderCard(inf, index) {
      return (
        '<a class="influencer-card ' + influencerTheme(index) + '" href="' + escapeHtml(inf.slug) + '/" target="_blank" rel="noopener">' +
          '<div class="influencer-cover"><span class="influencer-badge">' + escapeHtml(inf.badge) + "</span></div>" +
          '<div class="influencer-avatar">' + escapeHtml(inf.avatarInitials) + "</div>" +
          '<div class="influencer-body">' +
            "<h3>" + escapeHtml(inf.name) + "</h3>" +
            '<p class="influencer-handle">' + escapeHtml(inf.slug) + "</p>" +
            '<span class="influencer-pill">' + escapeHtml(inf.category) + "</span>" +
            '<div class="influencer-reach"><i class="fa-brands fa-' + escapeHtml(inf.platform) + '" aria-hidden="true"></i><strong>' + escapeHtml(inf.followers) + "</strong><span class=\"visually-hidden\">" + escapeHtml(inf.platform) + " followers</span></div>" +
            '<div class="influencer-stats-row">' +
              "<div><strong>" + escapeHtml(inf.language) + '</strong><span><i class="fa-solid fa-spell-check" aria-hidden="true"></i><span class="visually-hidden">Language</span></span></div>' +
              "<div><strong>" + escapeHtml(inf.city) + '</strong><span><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span class="visually-hidden">City</span></span></div>' +
            "</div>" +
          "</div>" +
        "</a>"
      );
    }

    var API_URL = apiBase + "/list-influencers.php";
    var FILTERS_URL = "data/filters.json";
    var fetchToken = 0;
    var currentPage = 1;

    // Every filter's option ids live in one place — website/data/filters.json
    // — shared with the backend (api/lib/filters.php) so search always runs
    // on the indexed numeric id, never label text. Adding/renaming an option
    // only ever means editing that one file. Each key here matches a
    // filters.json group one-to-one.
    function loadFilterOptions() {
      fetch(FILTERS_URL)
        .then(function (res) {
          if (!res.ok) throw new Error("Failed to load " + FILTERS_URL);
          return res.json();
        })
        .then(function (filterData) {
          filters.category.populate(filterData.categories || {});
          filters.platform.populate(filterData.platforms || {});
          filters.city.populate(filterData.cities || {});
          filters.state.populate(filterData.states || {});
          filters.language.populate(filterData.languages || {});
          // Followers/Age/Budget are ranges — filters.json's order IS the
          // meaningful low-to-high progression, so these skip the
          // alphabetical sort every other filter gets.
          filters.followers.populate(filterData.followers || {}, false);
          filters.status.populate(filterData.statuses || {});
          filters.gender.populate(filterData.genders || {});
          filters.age.populate(filterData.ages || {}, false);
          filters.budget.populate(filterData.budgets || {}, false);
        })
        .catch(function (err) { console.error(err); });
    }

    function renderPagination(page, totalPages, total, pageSize) {
      if (!pagination) return;

      // Only hide entirely when there's nothing to page through. A single
      // page still shows its range (e.g. "1 - 7") with both arrows
      // disabled, so the control doesn't disappear every time a filter
      // narrows the results below one page — it only goes away when there
      // are zero results.
      if (total <= 0) {
        pagination.innerHTML = "";
        return;
      }

      var rangeStart = (page - 1) * pageSize + 1;
      var rangeEnd = Math.min(page * pageSize, total);

      pagination.innerHTML =
        '<button type="button" class="page-nav-btn" data-page="' + (page - 1) + '"' + (page === 1 ? " disabled" : "") + '>' +
          '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i><span class="visually-hidden">Previous page</span>' +
        "</button>" +
        '<span class="page-range">' + rangeStart + " - " + rangeEnd + "</span>" +
        '<button type="button" class="page-nav-btn" data-page="' + (page + 1) + '"' + (page === totalPages ? " disabled" : "") + '>' +
          '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i><span class="visually-hidden">Next page</span>' +
        "</button>";
    }

    function applyFilters(resetPage) {
      if (resetPage) currentPage = 1;

      var params = new URLSearchParams();
      var query = searchInput.value.trim();
      if (query) params.set("q", query);

      // Each multiselect sends its chosen ids as one comma-separated value
      // (api/list-influencers.php matches any of them with IN, not =).
      var hasFilters = !!query;
      Object.keys(filters).forEach(function (key) {
        var values = filters[key].getValues();
        if (values.length) {
          hasFilters = true;
          params.set(key, values.join(","));
        }
      });
      // Page number alone doesn't count as a filter — paging through the
      // default unfiltered list should still show the rounded "10K+".
      params.set("page", currentPage);

      var thisFetch = ++fetchToken;

      fetch(API_URL + "?" + params.toString())
        .then(function (res) {
          if (!res.ok) throw new Error("Failed to load " + API_URL);
          return res.json();
        })
        .then(function (data) {
          if (thisFetch !== fetchToken) return; // a newer request superseded this one

          var pageResults = data.results || [];
          var total = typeof data.total === "number" ? data.total : pageResults.length;
          var cardsHtml = pageResults.length
            ? pageResults.map(renderCard).join("")
            : '<p class="find-empty-state">No creators match these filters yet. Try widening your search.</p>';

          grid.innerHTML = cardsHtml;

          if (resultsCount) {
            resultsCount.innerHTML = hasFilters
              ? "<strong>" + total + "</strong> creator" + (total === 1 ? "" : "s") + " found"
              : "<strong>10K+</strong> creators found";
          }

          currentPage = data.page || currentPage;
          renderPagination(currentPage, data.totalPages || 1, total, data.pageSize || 20);

          // The chips/badge reflect what's actually been applied (and is
          // now showing in the grid), not whatever's mid-edit inside the
          // still-open panel — so this only runs once a fetch lands.
          appliedValues = snapshotFilters();
          updateFilterSummary();
        })
        .catch(function (err) {
          console.error(err);
          grid.innerHTML = '<p class="find-empty-state">Couldn\'t load creators right now. Please try again shortly.</p>';
          if (pagination) pagination.innerHTML = "";
        });
    }

    loadFilterOptions();
    applyFilters(true);

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") applyFilters(true);
    });

    if (pagination) {
      pagination.addEventListener("click", function (e) {
        var btn = e.target.closest(".page-nav-btn");
        if (!btn || btn.disabled) return;
        var page = parseInt(btn.getAttribute("data-page"), 10);
        if (!page || page === currentPage) return;
        currentPage = page;
        applyFilters(false);
      });
    }

    // Full reset — search text plus every filter in the panel.
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        searchInput.value = "";
        Object.keys(filters).forEach(function (key) { filters[key].clear(); });
        applyFilters(true);
      });
    }

    if (openFiltersBtn) openFiltersBtn.addEventListener("click", openFiltersPanel);
    if (closeFiltersBtn) closeFiltersBtn.addEventListener("click", function () { closeFiltersPanel(true); });
    if (filtersOverlay) filtersOverlay.addEventListener("click", function () { closeFiltersPanel(true); });

    // "Apply Filters" inside the panel is the only thing that turns the
    // panel's checkbox edits into an actual request — ticking boxes alone
    // never fires one, same batching rationale as the old inline Apply
    // button (avoids one API call per checkbox while working through 10
    // filters).
    if (panelApplyBtn) {
      panelApplyBtn.addEventListener("click", function () {
        applyFilters(true);
        closeFiltersPanel(false);
      });
    }

    // "Clear All" inside the panel is a direct, unambiguous action (unlike
    // ticking a box, there's no "did they mean to apply this yet" question)
    // so it clears and re-fetches immediately, without needing Apply too.
    if (panelClearBtn) {
      panelClearBtn.addEventListener("click", function () {
        Object.keys(filters).forEach(function (key) { filters[key].clear(); });
        applyFilters(true);
      });
    }

    // Removing a chip is the same kind of direct action as "Clear All" —
    // it takes effect immediately rather than waiting for the panel's
    // Apply button.
    if (activeFilterChips) {
      activeFilterChips.addEventListener("click", function (e) {
        var removeBtn = e.target.closest("button");
        if (!removeBtn) return;
        var chip = removeBtn.closest(".filter-chip");
        var key = chip.getAttribute("data-filter-key");
        var id = chip.getAttribute("data-filter-id");
        if (!filters[key]) return;
        filters[key].removeValue(id);
        applyFilters(true);
      });
    }
  })();

  // Homepage hero: animate the likes/comments/share icons so the profile
  // card reads as "live" instead of static.
  (function animateHeroEngagement() {
    var likeAction = document.getElementById("heroLikeAction");
    var commentAction = document.getElementById("heroCommentAction");
    var shareAction = document.getElementById("heroShareAction");
    if (!likeAction || !commentAction || !shareAction) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var likeCountEl = document.getElementById("heroLikeCount");
    var likeDeltaEl = document.getElementById("heroLikeDelta");
    var commentCountEl = document.getElementById("heroCommentCount");
    var commentDeltaEl = document.getElementById("heroCommentDelta");

    var likeRaw = 48200;
    var commentRaw = 1300;

    function formatK(n) {
      return (n / 1000).toFixed(1) + "K";
    }

    function bumpCount(actionEl, countEl, deltaEl, raw, min, max) {
      var delta = Math.floor(Math.random() * (max - min + 1)) + min;
      raw += delta;
      countEl.textContent = formatK(raw);

      if (!reduceMotion) {
        deltaEl.textContent = "+" + delta;
        deltaEl.classList.remove("is-floating");
        void deltaEl.offsetWidth;
        deltaEl.classList.add("is-floating");

        countEl.classList.remove("is-bumping");
        void countEl.offsetWidth;
        countEl.classList.add("is-bumping");

        actionEl.classList.remove("is-bumping");
        void actionEl.offsetWidth;
        actionEl.classList.add("is-bumping");
      }

      return raw;
    }

    function pulseIcon(actionEl) {
      if (reduceMotion) return;
      actionEl.classList.remove("is-bumping");
      void actionEl.offsetWidth;
      actionEl.classList.add("is-bumping");
    }

    function scheduleLikes() {
      likeRaw = bumpCount(likeAction, likeCountEl, likeDeltaEl, likeRaw, 3, 27);
      setTimeout(scheduleLikes, 2600 + Math.random() * 1800);
    }

    function scheduleComments() {
      commentRaw = bumpCount(commentAction, commentCountEl, commentDeltaEl, commentRaw, 1, 4);
      setTimeout(scheduleComments, 5200 + Math.random() * 3200);
    }

    function scheduleShare() {
      pulseIcon(shareAction);
      setTimeout(scheduleShare, 9000 + Math.random() * 4000);
    }

    setTimeout(scheduleLikes, 1400);
    setTimeout(scheduleComments, 3000);
    setTimeout(scheduleShare, 5000);
  })();

  // Homepage featured influencers: top creators by followers, straight from
  // the live API. The API lists one row per account, so a creator with both
  // Instagram and YouTube can appear twice in the raw results — dedupe by
  // slug before taking the top 4 so this small showcase never repeats a name.
  (function renderFeaturedInfluencers() {
    var grid = document.getElementById("featuredInfluencerGrid");
    if (!grid) return;

    fetch(apiBase + "/list-influencers.php?page=1")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load featured influencers");
        return res.json();
      })
      .then(function (data) {
        var seen = {};
        var featured = [];
        (data.results || []).forEach(function (inf) {
          if (featured.length >= 4 || seen[inf.slug]) return;
          seen[inf.slug] = true;
          featured.push(inf);
        });

        grid.innerHTML = featured.map(function (inf, index) {
          return (
            '<a class="influencer-card ' + influencerTheme(index) + '" href="' + escapeHtml(inf.slug) + '/" target="_blank" rel="noopener">' +
              '<div class="influencer-cover"><span class="influencer-badge">' + escapeHtml(inf.badge) + "</span></div>" +
              '<div class="influencer-avatar">' + escapeHtml(inf.avatarInitials) + "</div>" +
              '<div class="influencer-body">' +
                "<h3>" + escapeHtml(inf.name) + "</h3>" +
                '<p class="influencer-handle">' + escapeHtml(inf.handle) + "</p>" +
                '<span class="influencer-pill">' + escapeHtml(inf.category) + "</span>" +
                '<div class="influencer-reach"><i class="fa-brands fa-' + escapeHtml(inf.platform) + '" aria-hidden="true"></i><strong>' + escapeHtml(inf.followers) + "</strong><span class=\"visually-hidden\">" + escapeHtml(inf.platform) + " followers</span></div>" +
                '<div class="influencer-stats-row">' +
                  "<div><strong>" + escapeHtml(inf.language) + '</strong><span><i class="fa-solid fa-spell-check" aria-hidden="true"></i><span class="visually-hidden">Language</span></span></div>' +
                  "<div><strong>" + escapeHtml(inf.city) + '</strong><span><i class="fa-solid fa-location-dot" aria-hidden="true"></i><span class="visually-hidden">City</span></span></div>' +
                "</div>" +
              "</div>" +
            "</a>"
          );
        }).join("");
      })
      .catch(function (err) { console.error(err); });
  })();

  // Homepage campaign grid.
  renderFromJson(".campaign-grid", function (c) {
    var tags = c.tags.map(function (t) { return "<span>" + escapeHtml(t) + "</span>"; }).join("");
    return (
      '<a class="campaign-card ' + escapeHtml(c.theme) + '">' +
        '<div class="campaign-banner">' +
          '<span class="campaign-live"><span class="live-dot" aria-hidden="true"></span>Live</span>' +
          '<span class="brand-logo">' + escapeHtml(c.brandInitials) + "</span>" +
          "<div>" +
            "<strong>" + escapeHtml(c.title) + "</strong>" +
            "<span>" + escapeHtml(c.brandName) + "</span>" +
          "</div>" +
        "</div>" +
        '<div class="campaign-body">' +
          "<p>" + escapeHtml(c.description) + "</p>" +
          '<div class="campaign-tags">' + tags + "</div>" +
          '<div class="campaign-meta-row">' +
            "<div>" +
              '<span class="budget-label">Budget</span>' +
              '<span class="budget-amount">' + escapeHtml(c.budget) + "</span>" +
            "</div>" +
            '<div class="campaign-meta-right">' +
              '<span class="campaign-days-left">' + escapeHtml(c.daysLeft) + "</span>" +
              '<span class="applied-pill">' + escapeHtml(c.applied) + "</span>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</a>"
    );
  });

  // Campaigns page: list every open campaign from data/campaigns.json, with
  // an unlock-unlimited-campaigns card always pinned first. No filters on
  // this page. Keyed on the #campaignsResultsGrid id (not just the
  // .campaign-grid class, which the homepage's preview grid above also
  // uses) so the two never both try to render into the same element.
  (function initCampaignsPage() {
    var grid = document.getElementById("campaignsResultsGrid");
    if (!grid) return;

    var UNLOCK_CARD_HTML =
      '<div class="campaign-card signup-card">' +
        '<div class="signup-card-inner">' +
          '<span class="signup-icon"><i class="fa-solid fa-lock-open" aria-hidden="true"></i></span>' +
          "<h3>Unlock Unlimited Campaigns</h3>" +
          "<p>Join free to see every open campaign and apply directly, with no limits.</p>" +
          '<a href="signup.html" class="btn btn-white btn-block">Join for Free</a>' +
        "</div>" +
      "</div>";

    function renderCampaignCard(c) {
      var tags = c.tags.map(function (t) { return "<span>" + escapeHtml(t) + "</span>"; }).join("");
      return (
        '<a class="campaign-card ' + escapeHtml(c.theme) + '" href="#">' +
          '<div class="campaign-banner">' +
            '<span class="campaign-live"><span class="live-dot" aria-hidden="true"></span>Live</span>' +
            '<span class="brand-logo">' + escapeHtml(c.brandInitials) + "</span>" +
            "<div>" +
              "<strong>" + escapeHtml(c.title) + "</strong>" +
              "<span>" + escapeHtml(c.brandName) + "</span>" +
            "</div>" +
          "</div>" +
          '<div class="campaign-body">' +
            "<p>" + escapeHtml(c.description) + "</p>" +
            '<div class="campaign-tags">' + tags + "</div>" +
            '<div class="campaign-meta-row">' +
              "<div>" +
                '<span class="budget-label">Budget</span>' +
                '<span class="budget-amount">' + escapeHtml(c.budget) + "</span>" +
              "</div>" +
              '<div class="campaign-meta-right">' +
                '<span class="campaign-days-left">' + escapeHtml(c.daysLeft) + "</span>" +
                '<span class="applied-pill">' + escapeHtml(c.applied) + "</span>" +
              "</div>" +
            "</div>" +
          "</div>" +
        "</a>"
      );
    }

    fetch("data/campaigns.json")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load data/campaigns.json");
        return res.json();
      })
      .then(function (items) {
        grid.innerHTML = UNLOCK_CARD_HTML + items.map(renderCampaignCard).join("");
      })
      .catch(function (err) {
        console.error(err);
        grid.innerHTML = UNLOCK_CARD_HTML + '<p class="find-empty-state">Couldn\'t load campaigns right now. Please try again shortly.</p>';
      });
  })();

  // Contact page form — submits to a Google Form.
  (function () {
    var form = document.getElementById("contactForm");
    if (!form) return;

    var submitBtn = document.getElementById("submitBtn");
    var messageDiv = document.getElementById("message");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      messageDiv.style.display = "none";

      var name = document.getElementById("name").value.trim();
      var email = document.getElementById("email").value.trim();
      var subject = document.getElementById("subject").value.trim();
      var messageText = document.getElementById("message-text").value.trim();
      var formURL = "https://docs.google.com/forms/d/e/1FAIpQLSddnAlG7v2mh875G9fhxgXETTds56DL1IdOixNofI7nD7fSgw/formResponse";

      var formData = new FormData();
      formData.append("entry.691538370", name);
      formData.append("entry.1327667417", email);
      formData.append("entry.421505376", subject);
      formData.append("entry.2001632591", messageText);

      try {
        await fetch(formURL, { method: "POST", mode: "no-cors", body: formData });
        messageDiv.classList.add("is-visible");
        messageDiv.textContent = "Message received successfully! We'll get back to you soon.";
        messageDiv.style.display = "block";
        form.reset();
        setTimeout(function () { messageDiv.style.display = "none"; }, 5000);
      } catch (error) {
        messageDiv.classList.add("is-error");
        messageDiv.textContent = "Something went wrong. Please try again.";
        messageDiv.style.display = "block";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    });
  })();

  // Signup page (simple influencer-only form, submits to a Google Form).
  (function () {
    var form = document.getElementById("signupForm");
    if (!form) return;

    var submitBtn = document.getElementById("signupSubmitBtn");
    var messageDiv = document.getElementById("message");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
      messageDiv.style.display = "none";

      var name = document.getElementById("signup-name").value.trim();
      var email = document.getElementById("signup-email").value.trim();
      var phone = document.getElementById("signup-phone").value.trim();
      var formURL = "https://docs.google.com/forms/d/e/1FAIpQLSdbADJz-IFfCXmoonz9R_Z6xzop61B-rC3ub8BEhmfBFe_PqA/formResponse";

      var formData = new FormData();
      formData.append("entry.1172266666", name);
      formData.append("entry.178361927", email);
      formData.append("entry.220222765", phone);
      formData.append("entry.1879586251", "Influencer");

      try {
        await fetch(formURL, { method: "POST", mode: "no-cors", body: formData });
        messageDiv.classList.remove("is-error");
        messageDiv.classList.add("is-visible");
        messageDiv.textContent = "Thanks! We've received your details and will be in touch soon.";
        messageDiv.style.display = "block";
        form.reset();
        setTimeout(function () { messageDiv.style.display = "none"; }, 5000);
      } catch (error) {
        messageDiv.classList.add("is-error");
        messageDiv.textContent = "Something went wrong. Please try again.";
        messageDiv.style.display = "block";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Register as Influencer";
      }
    });
  })();

})();
