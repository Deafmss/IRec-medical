# iRec Development Rules & Guidelines

This document contains Workspace-specific instructions and behavioral constraints that all AI coding assistants must strictly follow.

## 🩺 Absolute Clinical Truth & Patient Transparency

1. **Explicit Simulation Disclaimers:**
   - The system must **NEVER** display simulated clinical data, diagnostic conclusions, or sensor readings to patients or healthcare professionals without explicitly stating that they are simulated, educational, or for demonstration purposes.
   - Any telemetry, mock sensor values, or test data must carry clear, visible disclaimers in the user interface.

2. **No Misleading UI Placeholders:**
   - Avoid placeholders that look like actual clinical calculations.
   - Maintain 100% honesty about system status (e.g., if the Gemini AI API is offline or not configured, show clear errors instead of silently rendering mock diagnostic reports).

3. **Interoperability and Standards Integrity:**
   - Maintain strict conformance with clinical models (e.g., FHIR formatting in exports, authentic CID-10 coding) and do not introduce fake or invalid codes in patient records.
