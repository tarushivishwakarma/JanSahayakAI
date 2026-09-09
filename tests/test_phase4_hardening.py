"""
Phase 4 Regression Tests — Performance, UX, and Hardening

Tests added in Phase 4 to verify:
1. ai/service.py uses structured logging (no bare print statements)
2. ai/router.py uses structured logging
3. OCR router reads file in bounded manner (MAX_FILE_SIZE+1)
4. .env.example does not contain admin@test.com
5. .env.example has DEBUG=false as default
6. admin.js does not contain getDemoApplications
7. runtime.txt exists and specifies python-3.12
8. SCHEMES_DATA loaded at module level in ai/service.py
9. ai/service.py logger named correctly
"""

import ast
import os
import re
import unittest


REPO_ROOT = os.path.join(os.path.dirname(__file__), "..")


def read_file(rel_path: str) -> str:
    full = os.path.join(REPO_ROOT, rel_path)
    with open(full, "r", encoding="utf-8") as f:
        return f.read()


class Phase4BackendLoggingTests(unittest.TestCase):
    """Verify print() statements have been replaced with structured logger calls in ai/."""

    def test_01_ai_service_no_bare_print(self):
        """ai/service.py must not contain bare print() calls."""
        src = read_file("ai/service.py")
        # Allow print() only inside string literals or comments
        # Use AST to check for Call nodes named 'print'
        tree = ast.parse(src)
        print_calls = [
            node for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "print"
        ]
        self.assertEqual(
            len(print_calls), 0,
            f"ai/service.py contains {len(print_calls)} bare print() call(s) — use logger.*"
        )

    def test_02_ai_router_no_bare_print(self):
        """ai/router.py must not contain bare print() calls."""
        src = read_file("ai/router.py")
        tree = ast.parse(src)
        print_calls = [
            node for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "print"
        ]
        self.assertEqual(
            len(print_calls), 0,
            f"ai/router.py contains {len(print_calls)} bare print() call(s) — use logger.*"
        )

    def test_03_ai_service_has_logger(self):
        """ai/service.py must declare a module-level logger."""
        src = read_file("ai/service.py")
        self.assertIn('logging.getLogger("jansahayak.ai")', src,
                      "ai/service.py must define logger = logging.getLogger('jansahayak.ai')")

    def test_04_ai_router_has_logger(self):
        """ai/router.py must declare a module-level logger."""
        src = read_file("ai/router.py")
        self.assertIn("logging.getLogger", src,
                      "ai/router.py must define a logger via logging.getLogger()")

    def test_05_ai_service_schemes_loaded_at_module_level(self):
        """ai/service.py must load SCHEMES_DATA at module level (not per-request)."""
        src = read_file("ai/service.py")
        self.assertIn("SCHEMES_DATA = []", src,
                      "SCHEMES_DATA should be declared at module level")
        # SCHEMES_DATA must be populated before any function definitions
        # Simple check: SCHEMES_DATA assignment appears before first 'def '
        schemes_pos = src.index("SCHEMES_DATA = []")
        first_def_pos = src.index("def ")
        self.assertLess(schemes_pos, first_def_pos,
                        "SCHEMES_DATA must be initialised before function definitions (module-level cache)")


class Phase4OCRTests(unittest.TestCase):
    """Verify OCR router guards against oversized uploads efficiently."""

    def test_06_ocr_reads_bounded_bytes(self):
        """ocr.py must read at most MAX_FILE_SIZE+1 bytes, not unbounded."""
        src = read_file("ocr.py")
        # The file.read() call should pass MAX_FILE_SIZE + 1 as an argument
        self.assertIn("file.read(MAX_FILE_SIZE + 1)", src,
                      "ocr.py must use file.read(MAX_FILE_SIZE + 1) to bound memory before size check")

    def test_07_ocr_size_check_before_magic_byte(self):
        """ocr.py must check file size before magic-byte validation in the endpoint body."""
        src = read_file("ocr.py")
        # Find the endpoint function body — search after the @router.post decorator
        endpoint_start = src.index("@router.post")
        endpoint_body = src[endpoint_start:]
        size_check_pos = endpoint_body.index("len(file_bytes) > MAX_FILE_SIZE")
        # validate_image_bytes( call in endpoint body
        validate_call_pos = endpoint_body.index("validate_image_bytes(file_bytes)")
        self.assertLess(size_check_pos, validate_call_pos,
                        "Size check must come before validate_image_bytes() call in endpoint body")


class Phase4EnvConfigTests(unittest.TestCase):
    """Verify .env.example does not contain dangerous defaults."""

    def test_08_env_example_no_test_admin(self):
        """'.env.example' must not contain admin@test.com as an example admin."""
        src = read_file(".env.example")
        self.assertNotIn(
            "admin@test.com", src,
            ".env.example must not include admin@test.com — it is a development account"
        )

    def test_09_env_example_debug_false(self):
        """.env.example must default DEBUG to false, not true."""
        src = read_file(".env.example")
        # Should not have DEBUG=true as a bare assignment
        self.assertNotIn("DEBUG=true", src,
                         ".env.example must not default DEBUG=true — use DEBUG=false for production guidance")

    def test_10_env_example_admin_emails_empty_default(self):
        """.env.example must have ADMIN_EMAILS= with no populated values as default."""
        src = read_file(".env.example")
        # ADMIN_EMAILS line should exist and be empty or commented-example
        self.assertIn("ADMIN_EMAILS=", src,
                      ".env.example must contain ADMIN_EMAILS= variable")
        # Check the actual assignment line has no email addresses
        for line in src.splitlines():
            if line.startswith("ADMIN_EMAILS="):
                value = line.split("=", 1)[1].strip()
                self.assertEqual(value, "",
                                 f"ADMIN_EMAILS= default must be empty in .env.example, got: '{value}'")


class Phase4RuntimeTests(unittest.TestCase):
    """Verify runtime.txt exists and pins a compatible Python version."""

    def test_11_runtime_txt_exists(self):
        """runtime.txt must exist to pin Python version for Render deployment."""
        path = os.path.join(REPO_ROOT, "runtime.txt")
        self.assertTrue(os.path.exists(path),
                        "runtime.txt must exist to pin Python version for Render deployment")

    def test_12_runtime_txt_specifies_python_312(self):
        """runtime.txt must specify Python 3.12 for Pillow 10.3.0 compatibility."""
        src = read_file("runtime.txt").strip()
        self.assertTrue(
            src.startswith("python-3.12"),
            f"runtime.txt must specify python-3.12.x, got: '{src}'"
        )


class Phase4AdminFrontendTests(unittest.TestCase):
    """Verify admin.js no longer contains demo/fake data fallback."""

    def test_13_admin_js_no_demo_applications(self):
        """admin.js must not contain getDemoApplications() function."""
        src = read_file("frontend/admin.js")
        self.assertNotIn(
            "getDemoApplications", src,
            "admin.js must not contain getDemoApplications() — fake data must never be shown to admin"
        )

    def test_14_admin_js_no_demo_data_fallback_pattern(self):
        """admin.js must not contain 'Demo data fallback' comment or demo-N IDs."""
        src = read_file("frontend/admin.js")
        self.assertNotIn("Demo data fallback", src)
        self.assertNotIn("demo-1", src,
                         "Hardcoded fake application IDs must not exist in admin.js")

    def test_15_admin_js_no_isDemo_check(self):
        """admin.js must not reference user.isDemo (non-existent Firebase property)."""
        src = read_file("frontend/admin.js")
        self.assertNotIn("user.isDemo", src,
                         "admin.js must not check user.isDemo — Firebase auth has no such property")

    def test_16_admin_js_handles_401_403_separately(self):
        """admin.js must distinguish 401/403 from other errors and not fall through to demo data."""
        src = read_file("frontend/admin.js")
        self.assertIn("resp.status === 401 || resp.status === 403", src,
                      "admin.js must explicitly handle 401/403 from backend as an auth denial")


class Phase4FormWizardTests(unittest.TestCase):
    """Verify form-wizard.js prevents double-submit."""

    def test_17_form_wizard_disables_button_during_submit(self):
        """form-wizard.js must disable submit button during submission."""
        src = read_file("frontend/form-wizard.js")
        self.assertIn("submitBtn.disabled = true", src,
                      "form-wizard.js must disable submit button to prevent double-submission")

    def test_18_form_wizard_re_enables_on_error(self):
        """form-wizard.js must re-enable submit button if submission fails."""
        src = read_file("frontend/form-wizard.js")
        self.assertIn("submitBtn.disabled = false", src,
                      "form-wizard.js must re-enable submit button on error so user can retry")

    def test_19_form_wizard_has_abort_controller(self):
        """form-wizard.js must use AbortController for network timeout."""
        src = read_file("frontend/form-wizard.js")
        self.assertIn("AbortController", src,
                      "form-wizard.js must use AbortController for submission timeout")

    def test_20_form_wizard_clears_draft_only_on_success(self):
        """form-wizard.js must only clear draft after confirmed backend success."""
        src = read_file("frontend/form-wizard.js")
        # clearOfflineProgress must appear before onSubmitSuccessCb and after resp.json()
        clear_pos = src.index("clearOfflineProgress(currentServiceId)")
        success_pos = src.index("onSubmitSuccessCb(applicationData)")
        self.assertLess(clear_pos, success_pos,
                        "Draft must be cleared before success callback is invoked")
        # And clearOfflineProgress must NOT appear in the catch block
        catch_pos = src.index("} catch (err)")
        self.assertGreater(catch_pos, clear_pos,
                           "clearOfflineProgress must not be in the catch block")


class Phase4ServicesJsTests(unittest.TestCase):
    """Verify services.js no longer has a duplicate escapeHtml."""

    def test_21_services_js_no_duplicate_escape_html(self):
        """services.js must not define its own escapeHtml function."""
        src = read_file("frontend/services.js")
        self.assertNotIn(
            "function escapeHtml", src,
            "services.js must import escapeHtml from utils.js, not redefine it"
        )

    def test_22_services_js_imports_escape_html_from_utils(self):
        """services.js must import escapeHtml from utils.js."""
        src = read_file("frontend/services.js")
        self.assertIn("from './utils.js'", src,
                      "services.js must import utilities from utils.js")
        self.assertIn("escapeHtml", src,
                      "services.js must use escapeHtml imported from utils.js")


class Phase4AppJsTests(unittest.TestCase):
    """Verify app.js updates <html lang> on language toggle and toasts."""

    def test_23_app_js_updates_html_lang_on_toggle(self):
        """app.js must update document.documentElement.lang when language is toggled."""
        src = read_file("frontend/app.js")
        self.assertIn("document.documentElement.lang", src,
                      "app.js must update the <html lang> attribute when language is toggled")

    def test_24_toast_role_alert_only_for_error(self):
        """app.js must set role='alert' only for urgent error toasts, not decorative ones."""
        src = read_file("frontend/app.js")
        self.assertIn("type === 'error'", src)
        self.assertIn("toast.setAttribute('role', 'status')", src)


class Phase4SchemeResultsTests(unittest.TestCase):
    """Verify scheme-results.js has removed client-side eligibility duplication."""

    def test_25_scheme_results_no_client_filterSchemes(self):
        """scheme-results.js must NOT contain duplicate filterSchemes client logic."""
        src = read_file("frontend/scheme-results.js")
        self.assertNotIn("function filterSchemes", src,
                         "filterSchemes() must be removed — backend /api/schemes/evaluate is authoritative")

    def test_26_scheme_results_evaluates_via_authoritative_backend(self):
        """scheme-results.js must call backend /api/schemes/evaluate for evaluation."""
        src = read_file("frontend/scheme-results.js")
        self.assertIn("/api/schemes/evaluate", src)
        self.assertIn("evalResult.status === 'ELIGIBLE'", src)


class Phase4UtilsAndTrackerTests(unittest.TestCase):
    """Verify utils.js timeout and tracker.js error UX."""

    def test_27_auth_fetch_has_timeout_support(self):
        """authFetch in utils.js must support timeout and default to bounded timeout."""
        src = read_file("frontend/utils.js")
        self.assertIn("timeout", src)
        self.assertIn("TimeoutError", src)

    def test_28_utils_safe_error_logging(self):
        """utils.js must log only safe error codes, never raw tokens or stack traces."""
        src = read_file("frontend/utils.js")
        self.assertNotIn("console.warn('Error fetching Firebase ID token:', err)", src)
        self.assertIn("err.code || 'TOKEN_FETCH_ERROR'", src)

    def test_29_tracker_distinguishes_401_403_503(self):
        """tracker.js must explicitly distinguish 401, 403, and 503 errors."""
        src = read_file("frontend/tracker.js")
        self.assertIn("resp.status === 401", src)
        self.assertIn("resp.status === 403", src)
        self.assertIn("resp.status === 503", src)

    def test_30_tracker_shows_degraded_advisory_banner(self):
        """tracker.js must display a visible advisory banner when showing cached records."""
        src = read_file("frontend/tracker.js")
        self.assertIn("isDegraded", src)
        self.assertIn("Authoritative application service is temporarily unreachable", src)


class Phase4AccessibilityAndRateLimiterTests(unittest.TestCase):
    """Verify HTML a11y landmarks and in-memory rate limiter cleanup."""

    def test_31_index_html_no_menubar_roles(self):
        """index.html must not use role='menubar' or role='menuitem' in navigation."""
        src = read_file("frontend/index.html")
        self.assertNotIn('role="menubar"', src)
        self.assertNotIn('role="menuitem"', src)
        self.assertNotIn('role="menu"', src)

    def test_32_index_html_no_redundant_role_main(self):
        """index.html must not assign role='main' to child sections inside semantic <main>."""
        src = read_file("frontend/index.html")
        self.assertNotIn('role="main"', src)

    def test_33_rate_limiter_stale_cleanup(self):
        """SlidingWindowRateLimiter cleans up expired entries to avoid memory growth."""
        import time
        from core.security import SlidingWindowRateLimiter
        limiter = SlidingWindowRateLimiter()
        old_time = time.time() - 120
        with limiter._lock:
            for i in range(105):
                limiter._requests[f"stale_user_{i}"] = [old_time]
        self.assertEqual(len(limiter._requests), 105)
        # Check a new user — should prune all expired keys
        limiter.check_rate_limit("active_user", max_requests=15, window_seconds=60)
        self.assertNotIn("stale_user_0", limiter._requests)
        self.assertEqual(len(limiter._requests), 1)
        self.assertIn("active_user", limiter._requests)


if __name__ == "__main__":
    unittest.main()

