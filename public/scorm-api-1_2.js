
if (typeof window !== "undefined") {
  if (!window.API) {
    (function() {
      // --- Internal State ---
      var cmiData = {
        "cmi.core.lesson_status": "not attempted",
        "cmi.core.score.raw": "",
        "cmi.suspend_data": ""
      };
      var initialized = false;
      var lastError = "0";

      // --- Helper Functions ---
      function log(method, ...args) {
        console.log("[SCORM] " + method, ...args);
      }

      // --- API Definition ---
      window.API = {
        LMSInitialize: function(param) {
          log("LMSInitialize", param);
          if (initialized) {
            lastError = "101"; // General Exception (often used for already initialized)
            return "false";
          }
          initialized = true;
          lastError = "0";
          return "true";
        },

        LMSFinish: function(param) {
          log("LMSFinish", param, "Final Data:", cmiData);
          if (!initialized) {
            lastError = "301"; // Not initialized
            return "false";
          }
          initialized = false;
          lastError = "0";
          return "true";
        },

        LMSGetValue: function(element) {
          log("LMSGetValue", element);
          if (!initialized) {
            lastError = "301";
            return "";
          }
          lastError = "0";
          return cmiData[element] || "";
        },

        LMSSetValue: function(element, value) {
          log("LMSSetValue", element, value);
          if (!initialized) {
            lastError = "301";
            return "false";
          }
          cmiData[element] = value;
          lastError = "0";
          return "true";
        },

        LMSCommit: function(param) {
          log("LMSCommit", param, "Current Data:", cmiData);
          if (!initialized) {
            lastError = "301";
            return "false";
          }
          lastError = "0";
          return "true";
        },

        LMSGetLastError: function() {
          log("LMSGetLastError returning", lastError);
          return lastError;
        },

        LMSGetErrorString: function(errorCode) {
          log("LMSGetErrorString", errorCode);
          var code = String(errorCode);
          if (code === "0") return "No error";
          if (code === "101") return "General exception (Already initialized)";
          if (code === "301") return "Not initialized";
          return "Unknown error";
        },

        LMSGetDiagnostic: function(errorCode) {
          log("LMSGetDiagnostic", errorCode);
          return "Diagnostic info for code: " + errorCode;
        }
      };

      console.log("[SCORM] SCORM 1.2 API shim initialised on window.API");
    })();
  }
}
