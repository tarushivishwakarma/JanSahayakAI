/**
 * i18n.js – Hindi / English translations for all UI text
 * Usage: import { t, setLang, getLang } from './i18n.js';
 */

const translations = {
  en: {
    // Navbar
    navServices: "Services",
    navFindSchemes: "Find Schemes",
    navTrack: "Track Applications",
    navAdmin: "Admin",
    navLogin: "Login",
    navLogout: "Logout",
    langToggle: "हिंदी",

    // Landing
    heroTitle: "JanSahayak AI",
    heroTagline: "Find Government Schemes You Are Eligible For in Seconds",
    btnStartChat: "Start Chat",
    btnTryDemo: "Try Demo",
    btnServices: "Services",
    feat1Title: "Smart AI Assistant",
    feat1Desc: "Answer simple questions and get personalized scheme recommendations",
    feat2Title: "Voice Support",
    feat2Desc: "Speak in Hindi or English and get instant results",
    feat3Title: "Apply Easily",
    feat3Desc: "Get step-by-step guidance and required documents list",
    stat1Label: "Schemes",
    stat2Label: "States",
    stat3Label: "Languages",
    stat4Label: "Services",

    // Service Dashboard
    dashTitle: "Smart Services",
    dashSubtitle: "Select a service to begin your application",
    ocrBannerTitle: "AI Document AutoFill",
    ocrBannerDesc: "Upload your Aadhaar or PAN card image to auto-fill forms instantly",
    ocrBannerBtn: "Upload",
    services: [
      { id: "aadhaar", icon: "🪪", title: "Aadhaar Correction", desc: "Update your name, date of birth, or address in Aadhaar", color: "#f97316" },
      { id: "pan", icon: "💳", title: "PAN Update", desc: "Correct or update your PAN card details", color: "#6366f1" },
      { id: "scholarship", icon: "🎓", title: "Scholarship Form", desc: "Apply for government educational scholarships", color: "#16a34a" },
      { id: "pension", icon: "👴", title: "Pension Scheme", desc: "Apply for old age, widow, or disability pension", color: "#0891b2" },
      { id: "ration", icon: "🌾", title: "Ration Card", desc: "Apply for a new ration card or update existing one", color: "#d97706" },
      { id: "income", icon: "📜", title: "Income Certificate", desc: "Get an income certificate for scheme eligibility proof", color: "#7c3aed" }
    ],
    applyBtn: "Apply Now",
    saveOffline: "Saved offline",

    // Chatbot
    chatTitle: "JanSahayak AI",
    chatSubtitle: "Smart Assistant",
    chatBack: "← Back",
    chatPlaceholder: "Type your answer...",
    chatWelcome: "Hello! I'm here to help you find government schemes you're eligible for. Let's start with a few questions.",
    chatComplete: "Great! Analyzing your profile to find matching schemes...",
    chatInputPlaceholder: "Type your answer...",
    questionOf: "Question",
    of: "of",
    listeningText: "🎤 Listening...",

    // Chatbot Questions
    questions: [
      { key: "state", question: "Which state do you live in?", type: "select", options: ["Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "Other"] },
      { key: "age", question: "What is your age?", type: "number" },
      { key: "income", question: "What is your annual income (in ₹)?", type: "number" },
      { key: "category", question: "Which category do you belong to?", type: "select", options: ["General", "OBC", "SC", "ST"] },
      { key: "occupation", question: "What is your occupation?", type: "select", options: ["Farmer", "Student", "Worker", "Trader", "Other"] },
      { key: "gender", question: "What is your gender?", type: "select", options: ["Male", "Female", "Other"] },
      { key: "disability", question: "Do you have any disability (>80%)?", type: "select", options: ["No", "Yes"] },
      { key: "maritalStatus", question: "What is your marital status? (Optional)", type: "select", options: ["Single", "Married", "Widow", "Widower", "Skip"] }
    ],

    // Scheme Results
    resultsTitle: "Your Matched Schemes",
    matchFound: "schemes found for you!",
    noMatch: "No schemes found matching your profile. Try adjusting your information.",
    central: "Central",
    state: "State",
    applyNow: "Apply Now",
    knowMore: "Know More",
    viewDashboard: "📊 Dashboard",
    newSearch: "← New Search",
    benefits: "Benefits",
    whyEligible: "Why You're Eligible",
    documents: "Required Documents",
    howToApply: "How to Apply",
    officialLink: "Official Link",
    visitPortal: "Visit the official portal",
    fillForm: "Fill the online application form",
    uploadDocs: "Upload required documents",
    submitNote: "Submit and note your application number",
    backToResults: "← Back to Results",
    backToSchemes: "← Back to Schemes",
    dashboardTitle: "Your Benefits Dashboard",
    totalMatched: "Total Schemes Matched",
    centralSchemes: "Central Schemes",
    stateSchemes: "State Schemes",
    estimatedBenefit: "Estimated Annual Benefits",
    estimatedNote: "Based on monetary schemes. Some schemes offer non-monetary benefits.",
    schemeBreakdown: "Scheme Breakdown",

    // Form Wizard
    wizardBack: "← Back",
    wizardNext: "Next →",
    wizardSubmit: "Submit Application",
    wizardStep: "Step",
    wizardSaved: "Progress saved offline",
    wizardRestored: "Previous progress restored",

    // Wizard question sets per service
    wizardServices: {
      aadhaar: {
        name: "Aadhaar Correction",
        steps: [
          { key: "fullName", question: "What is your full name as per Aadhaar?", type: "text", hint: "Enter as it should appear on Aadhaar" },
          { key: "enrollmentNo", question: "What is your Aadhaar Enrollment Number?", type: "text", hint: "14-digit number on your Aadhaar slip" },
          { key: "correctionType", question: "What needs to be corrected?", type: "select", options: ["Name", "Date of Birth", "Address", "Mobile Number", "Gender"] },
          { key: "dob", question: "What is your date of birth?", type: "text", hint: "Format: DD/MM/YYYY" },
          { key: "address", question: "What is your current address?", type: "text", hint: "Full address with PIN code" }
        ]
      },
      pan: {
        name: "PAN Update",
        steps: [
          { key: "fullName", question: "What is your full name?", type: "text", hint: "As per PAN card" },
          { key: "panNumber", question: "What is your current PAN number?", type: "text", hint: "10-character alphanumeric" },
          { key: "dob", question: "What is your date of birth?", type: "text", hint: "Format: DD/MM/YYYY" },
          { key: "correctionType", question: "What needs to be updated?", type: "select", options: ["Name", "Date of Birth", "Father's Name", "Signature", "Photo"] },
          { key: "mobile", question: "What is your mobile number?", type: "text", hint: "10-digit mobile number" }
        ]
      },
      scholarship: {
        name: "Scholarship Form",
        steps: [
          { key: "fullName", question: "What is your full name?", type: "text", hint: "As per school/college records" },
          { key: "institution", question: "What is the name of your school/college?", type: "text", hint: "Full institution name" },
          { key: "course", question: "What course are you studying?", type: "text", hint: "E.g., B.Tech, Class 10, etc." },
          { key: "income", question: "What is your family's annual income (₹)?", type: "number", hint: "Combined family income" },
          { key: "category", question: "What is your social category?", type: "select", options: ["General", "OBC", "SC", "ST"] },
          { key: "percentage", question: "What is your last exam percentage?", type: "number", hint: "Enter percentage (e.g., 75)" }
        ]
      },
      pension: {
        name: "Pension Scheme",
        steps: [
          { key: "fullName", question: "What is your full name?", type: "text", hint: "As per Aadhaar card" },
          { key: "age", question: "What is your age?", type: "number", hint: "Your current age in years" },
          { key: "pensionType", question: "Which pension scheme are you applying for?", type: "select", options: ["Old Age Pension (60+)", "Widow Pension", "Disability Pension (80%+)"] },
          { key: "income", question: "What is your annual income (₹)?", type: "number", hint: "All sources combined" },
          { key: "bankAccount", question: "What is your bank account number?", type: "text", hint: "For direct benefit transfer" }
        ]
      },
      ration: {
        name: "Ration Card",
        steps: [
          { key: "headName", question: "What is the head of family's name?", type: "text", hint: "Name as per Aadhaar" },
          { key: "familySize", question: "How many members are in your family?", type: "number", hint: "Total household members" },
          { key: "address", question: "What is your residential address?", type: "text", hint: "Full address with PIN code" },
          { key: "income", question: "What is your family's monthly income (₹)?", type: "number", hint: "Combined monthly income" },
          { key: "category", question: "Which category do you belong to?", type: "select", options: ["BPL (Below Poverty Line)", "AAY (Antyodaya Anna Yojana)", "APL (Above Poverty Line)"] }
        ]
      },
      income: {
        name: "Income Certificate",
        steps: [
          { key: "fullName", question: "What is your full name?", type: "text", hint: "As per government records" },
          { key: "address", question: "What is your residential address?", type: "text", hint: "Full address with PIN code" },
          { key: "occupation", question: "What is your occupation?", type: "select", options: ["Farmer", "Daily Wage Worker", "Business", "Government Employee", "Other"] },
          { key: "annualIncome", question: "What is your annual income from all sources (₹)?", type: "number", hint: "Include all income sources" },
          { key: "purpose", question: "Purpose of the income certificate?", type: "select", options: ["Scholarship", "Government Scheme", "Loan", "Legal Purpose", "Other"] }
        ]
      }
    },

    // Tracker
    trackerTitle: "Track Applications",
    trackerSubtitle: "Monitor the status of your submitted applications",
    statusSubmitted: "Submitted",
    statusReviewing: "Under Review",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    noApplications: "No applications found. Apply for a service to get started.",
    loginToTrack: "Please login to track your applications.",

    // Admin
    adminTitle: "Admin Dashboard",
    adminSubtitle: "Manage applications and view analytics",
    adminTotal: "Total Applications",
    adminPending: "Under Review",
    adminApproved: "Approved",
    adminRejected: "Rejected",
    adminColUser: "User",
    adminColService: "Service",
    adminColDate: "Date",
    adminColStatus: "Status",
    adminColAction: "Action",
    updateStatus: "Update Status",
    noAdminAccess: "You do not have admin access.",
    loginRequired: "Please login to access this page.",

    // Auth
    authLogin: "Login",
    authSignup: "Sign Up",
    authEmail: "Email",
    authPassword: "Password",
    authName: "Full Name",
    authGoogle: "Continue with Google",
    authOr: "or",

    // OCR
    ocrTitle: "AI Document AutoFill",
    ocrDesc: "Upload your Aadhaar or PAN card to auto-fill form fields",
    ocrZoneText: "Click or drag & drop your document image here",
    ocrExtracted: "Extracted Information:",
    ocrAutoFill: "✅ Auto-Fill Form",
    ocrReset: "🔄 Try Again",
    ocrLoading: "Extracting information…",
    ocrSuccess: "Form auto-filled successfully!",
    ocrError: "Could not extract information. Please fill manually.",

    // Accessibility
    a11yContrastLabel: "High Contrast",
    a11yFontLabel: "Font Size",
    a11yKeyboardLabel: "Keyboard Nav",

    // Toast
    toastLoginSuccess: "Logged in successfully!",
    toastLogoutSuccess: "Logged out successfully.",
    toastSignupSuccess: "Account created! Welcome!",
    toastFormSubmitted: "Application submitted successfully!",
    toastSavedOffline: "Progress saved offline.",
    toastRestoredOffline: "Previous progress restored.",

    // FAQ Chatbot
    faqTitle: "JanSahayak Help",
    faqSubtitle: "Ask about government schemes",
    faqWelcome: "Hi! 👋 How can I help you today? You can ask me about government schemes, documents needed, or how to apply.",
    faqSuggestions: ["What is Aadhaar?", "How to apply for pension?", "Documents for scholarship", "What is PAN card?"],
    faqAnswers: {
      aadhaar: "Aadhaar is a 12-digit unique identity number issued by UIDAI to every Indian resident. It links your biometrics and personal information.",
      pension: "To apply for pension schemes (Old Age, Widow, or Disability), go to Services → Pension Scheme. You need Aadhaar, age proof, income certificate, and bank account details.",
      scholarship: "For government scholarships, go to Services → Scholarship Form. Required documents: Aadhaar, marksheet, income certificate, and caste certificate (for SC/ST/OBC).",
      pan: "PAN (Permanent Account Number) is a 10-digit alphanumeric code issued by Income Tax Department. It is required for financial transactions and filing taxes.",
      ration: "Ration Card entitles families to subsidized food grains under PDS. Apply via Services → Ration Card with Aadhaar, family details, and income proof.",
      income: "Income Certificate is an official document certifying your annual income. It's needed for applying to many government schemes. Apply via Services → Income Certificate.",
      default: "I can help you with information about government schemes, required documents, and how to apply. Try asking about specific services like Aadhaar, PAN, pension, or scholarships!"
    }
  },

  hi: {
    // Navbar
    navServices: "सेवाएं",
    navFindSchemes: "योजनाएं खोजें",
    navTrack: "आवेदन ट्रैक करें",
    navAdmin: "एडमिन",
    navLogin: "लॉगिन",
    navLogout: "लॉगआउट",
    langToggle: "English",

    // Landing
    heroTitle: "जनसहायक AI",
    heroTagline: "सेकंड में पता करें आप किन सरकारी योजनाओं के लिए पात्र हैं",
    btnStartChat: "चैट शुरू करें",
    btnTryDemo: "डेमो आज़माएं",
    btnServices: "सेवाएं",
    feat1Title: "स्मार्ट AI सहायक",
    feat1Desc: "सरल प्रश्नों के उत्तर दें और व्यक्तिगत योजना सिफारिशें प्राप्त करें",
    feat2Title: "आवाज समर्थन",
    feat2Desc: "हिंदी या अंग्रेजी में बोलें और तुरंत परिणाम पाएं",
    feat3Title: "आसानी से आवेदन करें",
    feat3Desc: "चरण-दर-चरण मार्गदर्शन और आवश्यक दस्तावेजों की सूची प्राप्त करें",
    stat1Label: "योजनाएं",
    stat2Label: "राज्य",
    stat3Label: "भाषाएं",
    stat4Label: "सेवाएं",

    // Service Dashboard
    dashTitle: "स्मार्ट सेवाएं",
    dashSubtitle: "आवेदन शुरू करने के लिए एक सेवा चुनें",
    ocrBannerTitle: "AI दस्तावेज़ ऑटोफ़िल",
    ocrBannerDesc: "फॉर्म तुरंत भरने के लिए अपना आधार या पैन कार्ड अपलोड करें",
    ocrBannerBtn: "अपलोड करें",
    services: [
      { id: "aadhaar", icon: "🪪", title: "आधार सुधार", desc: "आधार में नाम, जन्म तिथि या पता अपडेट करें", color: "#f97316" },
      { id: "pan", icon: "💳", title: "PAN अपडेट", desc: "अपने पैन कार्ड की जानकारी सुधारें या अपडेट करें", color: "#6366f1" },
      { id: "scholarship", icon: "🎓", title: "छात्रवृत्ति फॉर्म", desc: "सरकारी शैक्षणिक छात्रवृत्तियों के लिए आवेदन करें", color: "#16a34a" },
      { id: "pension", icon: "👴", title: "पेंशन योजना", desc: "वृद्धावस्था, विधवा या विकलांगता पेंशन के लिए आवेदन करें", color: "#0891b2" },
      { id: "ration", icon: "🌾", title: "राशन कार्ड", desc: "नए राशन कार्ड के लिए आवेदन करें या मौजूदा अपडेट करें", color: "#d97706" },
      { id: "income", icon: "📜", title: "आय प्रमाण पत्र", desc: "योजना पात्रता प्रमाण के लिए आय प्रमाण पत्र प्राप्त करें", color: "#7c3aed" }
    ],
    applyBtn: "अभी आवेदन करें",
    saveOffline: "ऑफलाइन सहेजा गया",

    // Chatbot
    chatTitle: "जनसहायक AI",
    chatSubtitle: "स्मार्ट सहायक",
    chatBack: "← वापस",
    chatPlaceholder: "अपना उत्तर टाइप करें...",
    chatWelcome: "नमस्ते! मैं यहाँ आपको उन सरकारी योजनाओं को खोजने में मदद करने के लिए हूँ जिनके लिए आप पात्र हैं। आइए कुछ प्रश्नों से शुरू करें।",
    chatComplete: "बढ़िया! आपके प्रोफ़ाइल का विश्लेषण कर मिलान योजनाओं को खोज रहा हूँ...",
    chatInputPlaceholder: "अपना उत्तर टाइप करें...",
    questionOf: "प्रश्न",
    of: "में से",
    listeningText: "🎤 सुन रहा हूँ...",

    questions: [
      { key: "state", question: "आप किस राज्य में रहते हैं?", type: "select", options: ["Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "Other"] },
      { key: "age", question: "आपकी उम्र कितनी है?", type: "number" },
      { key: "income", question: "आपकी वार्षिक आय (₹ में) कितनी है?", type: "number" },
      { key: "category", question: "आप किस श्रेणी से संबंधित हैं?", type: "select", options: ["General", "OBC", "SC", "ST"] },
      { key: "occupation", question: "आपका व्यवसाय क्या है?", type: "select", options: ["Farmer", "Student", "Worker", "Trader", "Other"] },
      { key: "gender", question: "आपका लिंग क्या है?", type: "select", options: ["Male", "Female", "Other"] },
      { key: "disability", question: "क्या आपके पास कोई विकलांगता है (>80%)?", type: "select", options: ["No", "Yes"] },
      { key: "maritalStatus", question: "आपकी वैवाहिक स्थिति क्या है? (वैकल्पिक)", type: "select", options: ["Single", "Married", "Widow", "Widower", "Skip"] }
    ],

    // Scheme Results
    resultsTitle: "आपकी मिलान योजनाएं",
    matchFound: "योजनाएं आपके लिए मिलीं!",
    noMatch: "आपकी प्रोफ़ाइल से मेल खाने वाली कोई योजना नहीं मिली। अपनी जानकारी समायोजित करने का प्रयास करें।",
    central: "केंद्रीय",
    state: "राज्य",
    applyNow: "अभी आवेदन करें",
    knowMore: "अधिक जानें",
    viewDashboard: "📊 डैशबोर्ड",
    newSearch: "← नई खोज",
    benefits: "लाभ",
    whyEligible: "आप क्यों पात्र हैं",
    documents: "आवश्यक दस्तावेज",
    howToApply: "आवेदन कैसे करें",
    officialLink: "आधिकारिक लिंक",
    visitPortal: "आधिकारिक पोर्टल पर जाएं",
    fillForm: "ऑनलाइन आवेदन फॉर्म भरें",
    uploadDocs: "आवश्यक दस्तावेज अपलोड करें",
    submitNote: "सबमिट करें और अपना आवेदन नंबर नोट करें",
    backToResults: "← परिणामों पर वापस",
    backToSchemes: "← योजनाओं पर वापस",
    dashboardTitle: "आपका लाभ डैशबोर्ड",
    totalMatched: "कुल मिलान योजनाएं",
    centralSchemes: "केंद्रीय योजनाएं",
    stateSchemes: "राज्य योजनाएं",
    estimatedBenefit: "अनुमानित वार्षिक लाभ",
    estimatedNote: "मौद्रिक योजनाओं के आधार पर। कुछ योजनाएं गैर-मौद्रिक लाभ प्रदान करती हैं।",
    schemeBreakdown: "योजना विवरण",

    // Form Wizard
    wizardBack: "← वापस",
    wizardNext: "अगला →",
    wizardSubmit: "आवेदन जमा करें",
    wizardStep: "चरण",
    wizardSaved: "प्रगति ऑफलाइन सहेजी गई",
    wizardRestored: "पिछली प्रगति बहाल की गई",

    wizardServices: {
      aadhaar: {
        name: "आधार सुधार",
        steps: [
          { key: "fullName", question: "आधार के अनुसार आपका पूरा नाम क्या है?", type: "text", hint: "जैसा आधार पर दिखना चाहिए" },
          { key: "enrollmentNo", question: "आपका आधार नामांकन नंबर क्या है?", type: "text", hint: "14 अंकों का नंबर" },
          { key: "correctionType", question: "क्या सुधार की आवश्यकता है?", type: "select", options: ["नाम", "जन्म तिथि", "पता", "मोबाइल नंबर", "लिंग"] },
          { key: "dob", question: "आपकी जन्म तिथि क्या है?", type: "text", hint: "प्रारूप: DD/MM/YYYY" },
          { key: "address", question: "आपका वर्तमान पता क्या है?", type: "text", hint: "PIN कोड सहित पूरा पता" }
        ]
      },
      pan: {
        name: "PAN अपडेट",
        steps: [
          { key: "fullName", question: "आपका पूरा नाम क्या है?", type: "text", hint: "PAN कार्ड के अनुसार" },
          { key: "panNumber", question: "आपका वर्तमान PAN नंबर क्या है?", type: "text", hint: "10 अंकों का अल्फ़ान्यूमेरिक" },
          { key: "dob", question: "आपकी जन्म तिथि क्या है?", type: "text", hint: "प्रारूप: DD/MM/YYYY" },
          { key: "correctionType", question: "क्या अपडेट करना है?", type: "select", options: ["नाम", "जन्म तिथि", "पिता का नाम", "हस्ताक्षर", "फोटो"] },
          { key: "mobile", question: "आपका मोबाइल नंबर क्या है?", type: "text", hint: "10 अंकों का मोबाइल नंबर" }
        ]
      },
      scholarship: {
        name: "छात्रवृत्ति फॉर्म",
        steps: [
          { key: "fullName", question: "आपका पूरा नाम क्या है?", type: "text", hint: "स्कूल/कॉलेज रिकॉर्ड के अनुसार" },
          { key: "institution", question: "आपके स्कूल/कॉलेज का नाम क्या है?", type: "text", hint: "पूरा संस्थान का नाम" },
          { key: "course", question: "आप कौन सा कोर्स पढ़ रहे हैं?", type: "text", hint: "जैसे B.Tech, कक्षा 10 आदि" },
          { key: "income", question: "आपके परिवार की वार्षिक आय (₹) कितनी है?", type: "number", hint: "सभी स्रोतों से संयुक्त आय" },
          { key: "category", question: "आपकी सामाजिक श्रेणी क्या है?", type: "select", options: ["General", "OBC", "SC", "ST"] },
          { key: "percentage", question: "अंतिम परीक्षा में आपका प्रतिशत क्या था?", type: "number", hint: "प्रतिशत दर्ज करें (जैसे 75)" }
        ]
      },
      pension: {
        name: "पेंशन योजना",
        steps: [
          { key: "fullName", question: "आपका पूरा नाम क्या है?", type: "text", hint: "आधार कार्ड के अनुसार" },
          { key: "age", question: "आपकी उम्र कितनी है?", type: "number", hint: "वर्षों में आपकी वर्तमान आयु" },
          { key: "pensionType", question: "आप किस पेंशन योजना के लिए आवेदन कर रहे हैं?", type: "select", options: ["वृद्धावस्था पेंशन (60+)", "विधवा पेंशन", "विकलांगता पेंशन (80%+)"] },
          { key: "income", question: "आपकी वार्षिक आय (₹) कितनी है?", type: "number", hint: "सभी स्रोत मिलाकर" },
          { key: "bankAccount", question: "आपका बैंक खाता नंबर क्या है?", type: "text", hint: "प्रत्यक्ष लाभ हस्तांतरण के लिए" }
        ]
      },
      ration: {
        name: "राशन कार्ड",
        steps: [
          { key: "headName", question: "परिवार के मुखिया का नाम क्या है?", type: "text", hint: "आधार के अनुसार नाम" },
          { key: "familySize", question: "आपके परिवार में कितने सदस्य हैं?", type: "number", hint: "कुल घर के सदस्य" },
          { key: "address", question: "आपका आवासीय पता क्या है?", type: "text", hint: "PIN कोड सहित पूरा पता" },
          { key: "income", question: "आपके परिवार की मासिक आय (₹) कितनी है?", type: "number", hint: "संयुक्त मासिक आय" },
          { key: "category", question: "आप किस श्रेणी से संबंधित हैं?", type: "select", options: ["BPL (गरीबी रेखा से नीचे)", "AAY (अंत्योदय अन्न योजना)", "APL (गरीबी रेखा से ऊपर)"] }
        ]
      },
      income: {
        name: "आय प्रमाण पत्र",
        steps: [
          { key: "fullName", question: "आपका पूरा नाम क्या है?", type: "text", hint: "सरकारी रिकॉर्ड के अनुसार" },
          { key: "address", question: "आपका आवासीय पता क्या है?", type: "text", hint: "PIN कोड सहित पूरा पता" },
          { key: "occupation", question: "आपका व्यवसाय क्या है?", type: "select", options: ["किसान", "दैनिक मजदूर", "व्यवसाय", "सरकारी कर्मचारी", "अन्य"] },
          { key: "annualIncome", question: "सभी स्रोतों से आपकी वार्षिक आय (₹) कितनी है?", type: "number", hint: "सभी आय स्रोत शामिल करें" },
          { key: "purpose", question: "आय प्रमाण पत्र का उद्देश्य क्या है?", type: "select", options: ["छात्रवृत्ति", "सरकारी योजना", "ऋण", "कानूनी उद्देश्य", "अन्य"] }
        ]
      }
    },

    // Tracker
    trackerTitle: "आवेदन ट्रैक करें",
    trackerSubtitle: "अपने जमा किए गए आवेदनों की स्थिति देखें",
    statusSubmitted: "जमा किया",
    statusReviewing: "समीक्षाधीन",
    statusApproved: "स्वीकृत",
    statusRejected: "अस्वीकृत",
    noApplications: "कोई आवेदन नहीं मिला। शुरू करने के लिए किसी सेवा के लिए आवेदन करें।",
    loginToTrack: "अपने आवेदन ट्रैक करने के लिए कृपया लॉगिन करें।",

    // Admin
    adminTitle: "एडमिन डैशबोर्ड",
    adminSubtitle: "आवेदन प्रबंधित करें और विश्लेषण देखें",
    adminTotal: "कुल आवेदन",
    adminPending: "समीक्षाधीन",
    adminApproved: "स्वीकृत",
    adminRejected: "अस्वीकृत",
    adminColUser: "उपयोगकर्ता",
    adminColService: "सेवा",
    adminColDate: "दिनांक",
    adminColStatus: "स्थिति",
    adminColAction: "कार्रवाई",
    updateStatus: "स्थिति अपडेट करें",
    noAdminAccess: "आपके पास एडमिन पहुंच नहीं है।",
    loginRequired: "इस पेज तक पहुंचने के लिए कृपया लॉगिन करें।",

    // Auth
    authLogin: "लॉगिन",
    authSignup: "साइन अप",
    authEmail: "ईमेल",
    authPassword: "पासवर्ड",
    authName: "पूरा नाम",
    authGoogle: "Google से जारी रखें",
    authOr: "या",

    // OCR
    ocrTitle: "AI दस्तावेज़ ऑटोफ़िल",
    ocrDesc: "फॉर्म फ़ील्ड स्वतः भरने के लिए अपना आधार या PAN कार्ड अपलोड करें",
    ocrZoneText: "यहाँ क्लिक करें या अपना दस्तावेज़ छवि खींचें और छोड़ें",
    ocrExtracted: "निकाली गई जानकारी:",
    ocrAutoFill: "✅ फॉर्म स्वतः भरें",
    ocrReset: "🔄 फिर से प्रयास करें",
    ocrLoading: "जानकारी निकाली जा रही है…",
    ocrSuccess: "फॉर्म सफलतापूर्वक स्वतः भरा गया!",
    ocrError: "जानकारी नहीं निकाल सका। कृपया मैन्युअली भरें।",

    // Accessibility
    a11yContrastLabel: "उच्च कंट्रास्ट",
    a11yFontLabel: "फ़ॉन्ट आकार",
    a11yKeyboardLabel: "कीबोर्ड नेव",

    // Toast
    toastLoginSuccess: "सफलतापूर्वक लॉगिन हुए!",
    toastLogoutSuccess: "सफलतापूर्वक लॉगआउट हुए।",
    toastSignupSuccess: "खाता बनाया गया! स्वागत है!",
    toastFormSubmitted: "आवेदन सफलतापूर्वक जमा किया!",
    toastSavedOffline: "प्रगति ऑफलाइन सहेजी गई।",
    toastRestoredOffline: "पिछली प्रगति बहाल की गई।",

    // FAQ Chatbot
    faqTitle: "जनसहायक सहायता",
    faqSubtitle: "सरकारी योजनाओं के बारे में पूछें",
    faqWelcome: "नमस्ते! 👋 आज मैं आपकी कैसे मदद कर सकता हूँ? आप सरकारी योजनाओं, आवश्यक दस्तावेजों या आवेदन कैसे करें के बारे में पूछ सकते हैं।",
    faqSuggestions: ["आधार क्या है?", "पेंशन के लिए कैसे आवेदन करें?", "छात्रवृत्ति के लिए दस्तावेज़", "PAN कार्ड क्या है?"],
    faqAnswers: {
      aadhaar: "आधार UIDAI द्वारा प्रत्येक भारतीय निवासी को जारी किया गया 12 अंकों का विशिष्ट पहचान नंबर है। यह आपकी बायोमेट्रिक्स और व्यक्तिगत जानकारी से जुड़ा है।",
      pension: "पेंशन योजनाओं (वृद्धावस्था, विधवा, या विकलांगता) के लिए आवेदन करने के लिए, सेवाएं → पेंशन योजना पर जाएं। आपको आधार, आयु प्रमाण, आय प्रमाण पत्र और बैंक खाते की आवश्यकता है।",
      scholarship: "सरकारी छात्रवृत्ति के लिए, सेवाएं → छात्रवृत्ति फॉर्म पर जाएं। आवश्यक दस्तावेज: आधार, मार्कशीट, आय प्रमाण पत्र और जाति प्रमाण पत्र (SC/ST/OBC के लिए)।",
      pan: "PAN (स्थायी खाता संख्या) आयकर विभाग द्वारा जारी 10 अंकों का अल्फ़ान्यूमेरिक कोड है। यह वित्तीय लेनदेन और कर दाखिल करने के लिए आवश्यक है।",
      ration: "राशन कार्ड परिवारों को PDS के तहत सब्सिडी वाले खाद्यान्न का अधिकार देता है। सेवाएं → राशन कार्ड के माध्यम से आधार, पारिवारिक विवरण और आय प्रमाण के साथ आवेदन करें।",
      income: "आय प्रमाण पत्र एक आधिकारिक दस्तावेज़ है जो आपकी वार्षिक आय को प्रमाणित करता है। यह कई सरकारी योजनाओं के लिए आवश्यक है। सेवाएं → आय प्रमाण पत्र के माध्यम से आवेदन करें।",
      default: "मैं सरकारी योजनाओं, आवश्यक दस्तावेजों और आवेदन कैसे करें के बारे में जानकारी में आपकी मदद कर सकता हूँ। आधार, PAN, पेंशन या छात्रवृत्ति जैसी विशिष्ट सेवाओं के बारे में पूछें!"
    }
  }
};

let currentLang = localStorage.getItem('jansahayak-lang') || 'en';

/** Get translation for the current language */
export function t(key) {
  const lang = translations[currentLang];
  return lang && lang[key] !== undefined ? lang[key] : translations.en[key] || key;
}

/** Set language */
export function setLang(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('jansahayak-lang', lang);
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }
}

/** Get current language */
export function getLang() {
  return currentLang;
}

/** Toggle between en and hi */
export function toggleLang() {
  setLang(currentLang === 'en' ? 'hi' : 'en');
  return currentLang;
}
