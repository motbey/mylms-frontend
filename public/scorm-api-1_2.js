// public/scorm-api-1_2.js
// Minimal SCORM 1.2 API shim so Articulate/Rise thinks it's in an LMS.
// NOTE: This only stores values in memory for now – no real tracking yet.

(function () {
  // If an API already exists, don't overwrite it
  if (window.API) {
    return;
  }

  console.log("[MyLMS] Injecting SCORM 1.2 API shim");

  const cmi = {};
  let initialized = false;
  let finished = false;
  let lastError = "0";

  function setError(code) {
    lastError = String(code || "0");
  }

  function LMSInitialize(_param) {
    console.log("[SCORM] LMSInitialize");
    initialized = true;
    finished = false;
    setError("0");
    return "true";
  }

  function LMSFinish(_param) {
    console.log("[SCORM] LMSFinish");
    if (!initialized) {
      setError("301"); // Not initialized
      return "false";
    }
    finished = true;
    setError("0");
    return "true";
  }

  function LMSGetValue(element) {
    const key = String(element || "");
    const value = cmi[key] ?? "";
    console.log("[SCORM] LMSGetValue", key, "=>", value);
    setError("0");
    return String(value);
  }

  function LMSSetValue(element, value) {
    const key = String(element || "");
    const val = String(value ?? "");
    console.log("[SCORM] LMSSetValue", key, "=", val);
    cmi[key] = val;
    setError("0");
    return "true";
  }

  function LMSCommit(_param) {
    console.log("[SCORM] LMSCommit (no-op for now)");
    // Later we’ll push cmi to Supabase here.
    setError("0");
    return "true";
  }

  function LMSGetLastError() {
    return lastError;
  }

  function LMSGetErrorString(errorCode) {
    const map = {
      "0": "No error",
      "101": "General exception",
      "201": "Invalid argument error",
      "301": "Not initialized",
    };
    return map[String(errorCode)] || "Unknown error";
  }

  function LMSGetDiagnostic(_errorCode) {
    return "";
  }

  // Expose classic SCORM 1.2 API object
  window.API = {
    LMSInitialize,
    LMSFinish,
    LMSGetValue,
    LMSSetValue,
    LMSCommit,
    LMSGetLastError,
    LMSGetErrorString,
    LMSGetDiagnostic,
  };

  // Also define a very thin 2004-style API for packages that look for it
  if (!window.API_1484_11) {
    window.API_1484_11 = {
      Initialize: LMSInitialize,
      Terminate: LMSFinish,
      GetValue: LMSGetValue,
      SetValue: LMSSetValue,
      Commit: LMSCommit,
      GetLastError: LMSGetLastError,
      GetErrorString: LMSGetErrorString,
      GetDiagnostic: LMSGetDiagnostic,
    };
  }
})();