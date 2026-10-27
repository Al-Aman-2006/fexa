import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * ScrollToTop component
 * Resets window scroll position to the top upon route navigation (PUSH and REPLACE).
 * Preserves browser scroll restoration during POP navigation (Back / Forward).
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [pathname, search, navType]);

  return null;
}
