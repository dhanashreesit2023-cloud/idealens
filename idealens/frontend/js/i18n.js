/* i18n.js - tiny translation layer. t("English text") returns the translation or the English text. */
const LANGS = { en: "English", ta: "தமிழ்", hi: "हिन्दी" };
const DICT = {
  ta: {
    "Dashboard": "டாஷ்போர்டு", "New analysis": "புதிய பகுப்பாய்வு", "My reports": "என் அறிக்கைகள்", "Compare": "ஒப்பிடு",
    "Profile": "சுயவிவரம்", "How it works": "எப்படி செயல்படுகிறது", "Log in": "உள்நுழை", "Sign up": "பதிவு செய்",
    "Log out": "வெளியேறு", "Notifications": "அறிவிப்புகள்", "Submissions": "சமர்ப்பிப்புகள்", "Analytics": "புள்ளிவிவரங்கள்",
    "People": "நபர்கள்", "Users": "பயனர்கள்", "Light / dark": "ஒளி / இருள்", "Open dashboard": "டாஷ்போர்டைத் திற",
    "Install app": "செயலியை நிறுவு", "Analyse my idea": "என் யோசனையை பகுப்பாய்வு செய்", "Project title": "திட்டத்தின் தலைப்பு",
    "Description": "விளக்கம்", "Overview": "மேலோட்டம்", "Similar projects": "ஒத்த திட்டங்கள்", "Risks": "அபாயங்கள்",
    "Improve": "மேம்படுத்து", "Technology": "தொழில்நுட்பம்", "Roadmap": "வழிகாட்டி திட்டம்", "Versions": "பதிப்புகள்",
    "Mentor chat": "வழிகாட்டி உரையாடல்", "Feedback": "கருத்து", "Review": "மதிப்பாய்வு", "Print report": "அறிக்கையை அச்சிடு",
    "Email": "மின்னஞ்சல்", "Password": "கடவுச்சொல்", "Full name": "முழுப் பெயர்", "Workspace": "பணியிடம்",
    "Welcome back": "மீண்டும் வருக", "Create your account": "உங்கள் கணக்கை உருவாக்குங்கள்", "Create account": "கணக்கை உருவாக்கு",
    "Submit for review": "மதிப்பாய்வுக்கு அனுப்பு", "Download PDF": "PDF பதிவிறக்கு", "Forgot password?": "கடவுச்சொல் மறந்துவிட்டதா?",
    "Language": "மொழி", "Send": "அனுப்பு", "Admin": "நிர்வாகி", "Creator": "உருவாக்குநர்", "Reviewer": "மதிப்பாய்வாளர்",
    "Mark all read": "எல்லாவற்றையும் படித்ததாக குறி", "Overall": "மொத்தம்",
  },
  hi: {
    "Dashboard": "डैशबोर्ड", "New analysis": "नया विश्लेषण", "My reports": "मेरी रिपोर्ट", "Compare": "तुलना करें",
    "Profile": "प्रोफ़ाइल", "How it works": "यह कैसे काम करता है", "Log in": "लॉग इन", "Sign up": "साइन अप",
    "Log out": "लॉग आउट", "Notifications": "सूचनाएँ", "Submissions": "सबमिशन", "Analytics": "एनालिटिक्स",
    "People": "लोग", "Users": "उपयोगकर्ता", "Light / dark": "लाइट / डार्क", "Open dashboard": "डैशबोर्ड खोलें",
    "Install app": "ऐप इंस्टॉल करें", "Analyse my idea": "मेरे आइडिया का विश्लेषण करें", "Project title": "प्रोजेक्ट का शीर्षक",
    "Description": "विवरण", "Overview": "अवलोकन", "Similar projects": "समान प्रोजेक्ट", "Risks": "जोखिम",
    "Improve": "सुधारें", "Technology": "तकनीक", "Roadmap": "रोडमैप", "Versions": "संस्करण",
    "Mentor chat": "मेंटर चैट", "Feedback": "प्रतिक्रिया", "Review": "समीक्षा", "Print report": "रिपोर्ट प्रिंट करें",
    "Email": "ईमेल", "Password": "पासवर्ड", "Full name": "पूरा नाम", "Workspace": "वर्कस्पेस",
    "Welcome back": "फिर से स्वागत है", "Create your account": "अपना खाता बनाएँ", "Create account": "खाता बनाएँ",
    "Submit for review": "समीक्षा के लिए भेजें", "Download PDF": "PDF डाउनलोड करें", "Forgot password?": "पासवर्ड भूल गए?",
    "Language": "भाषा", "Send": "भेजें", "Admin": "एडमिन", "Creator": "क्रिएटर", "Reviewer": "समीक्षक",
    "Mark all read": "सभी को पढ़ा हुआ मानें", "Overall": "कुल",
  },
};
let CUR = localStorage.getItem("il_lang") || "en";
const getLang = () => CUR;
const setLang = (l) => { CUR = l; localStorage.setItem("il_lang", l); window.dispatchEvent(new Event("langchange")); };
const t = (k) => (CUR !== "en" && DICT[CUR] && DICT[CUR][k]) || k;
Object.assign(DICT.ta, { "Draft": "வரைவு", "Submitted": "சமர்ப்பிக்கப்பட்டது", "Under review": "மதிப்பாய்வில்", "Approved": "அங்கீகரிக்கப்பட்டது", "Needs changes": "மாற்றங்கள் தேவை" });
Object.assign(DICT.hi, { "Draft": "मसौदा", "Submitted": "जमा किया गया", "Under review": "समीक्षाधीन", "Approved": "स्वीकृत", "Needs changes": "बदलाव आवश्यक" });
const stLabel = (s) => t(STATUS[s] || s);

function LangPicker() {
  return html`<select class="lang" aria-label=${t("Language")} value=${getLang()} onChange=${(e) => setLang(e.target.value)}>
    ${Object.entries(LANGS).map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)}</select>`;
}
