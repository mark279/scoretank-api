import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';
import { gotScraping } from 'got-scraping';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetLeagues = [
    // بطولات قارية ودولية
    "كأس العالم", "دروع كونكاكاف الكاريبي", "كأس كوبا أمريكا", "كأس كوبا ليبرتادوريس", 
    "التصفيات المؤهلة لكأس العالم - أمريكا الجنوبية", "التصفيات المؤهلة لكأس العالم - أفريقيا", 
    "التصفيات المؤهلة لكأس العالم - آسيا", "كأس أمم أفريقيا", "دوري أبطال أفريقيا", 
    "دوري كرة القدم الأفريقي", "كأس الاتحاد الأفريقي - الكونفدرالية", "كأس السوبر الأفريقي", 
    "AFC Cup", "كأس أمم آسيا", "دوري أبطال آسيا", "دوري أبطال آسيا 2", "دوري أبطال آسيا النخبة", 
    "دوري التحدي الآسيوي", "كأس العالم للأندية", "كأس العرب لكرة القدم", "كأس العرب للأندية الأبطال", 
    "كأس القارات للأندية الأبطال", "بطولة أمم أوروبا", "دوري الأمم الأوروبية", "دوري أبطال أوروبا", 
    "الدوري الأوروبي", "دوري المؤتمر الأوروبي", "مباريات دولية ودية - أندية", "مباريات دولية ودية",

    // مصر
    "الدوري المصري الممتاز", "الدوري المصري الدرجة الثانية", "كأس الرابطة", 
    "كأس السوبر المصري", "كأس مصر",

    // إسبانيا
    "الدوري الإسباني الدرجة الأولى", "كأس الاتحاد الإسباني", "كأس السوبر الإسباني", "كأس ملك إسبانيا",

    // إنجلترا
    "الدوري الإنجليزي الممتاز", "كأس الاتحاد الإنجليزي", "كأس التحدي لاتحاد كرة القدم", "كأس الدوري الإنجليزي",

    // إيطاليا
    "الدوري الإيطالي الدرجة الأولى", "كأس إيطاليا", "كأس السوبر الإيطالي",

    // ألمانيا
    "الدوري الألماني", "كأس السوبرالألماني",

    // السعودية
    "دوري روشن السعودي", "دوري يلو للدرجة الأولى السعودي", "دوري المحترفين السعودي", 
    "تصفيات كأس ولي العهد السعودي", "كأس خادم الحرمين الشريفين للأبطال السعودي", "كأس ولي العهد السعودي",

    // الإمارات
    "دوري ادنوك الاماراتي للمحترفين", "الدوري الاماراتي الدرجة الاولى", "دوري الرديف الإماراتي", 
    "كأس السوبرالاماراتي", "كأس دبي الإماراتي", "كأس دبي للتحدي", "كأس رئيس الدولة الاماراتي", 
    "كأس رابطة المحترفين الإماراتية",

    // المغرب والجزائر وتونس
    "الدوري المغربي الإحترافي إنوي", "الرابطة المحترفة الجزائرية الأولى", "الدوري الجزائري القسم الثاني", 
    "كأس الجزائر", "كأس السوبر الجزائري", "الرابطة التونسية المحترفة الأولى",

    // الأردن وسوريا والعراق
    "الدوري الأردني للمحترفين", "الدوري الأردني الدرجة الأولى", "كأس الأردن", "كأس السوبر الأردني",
    "دوري نجوم العراق", "الدوري السوري الممتاز",

    // قطر، الكويت، عمان، البحرين
    "دوري OOREDOO القطري", "كأس OOREDOO القطري", "كأس أمير قطر", "كأس الاتحاد القطري", 
    "كأس الشيخ جاسم قطر", "كأس قطر", "كأس ولي العهد القطري", "الدوري الكويتي الممتاز", 
    "الدوري العماني للمحترفين عمانتل", "دوري المحترفين العماني", "دوري الدرجة الأولى البحريني",

    // السودان وليبيا ولبنان
    "الدوري الممتاز السوداني", "الدوري الليبي الممتاز", "الدوري اللبناني الممتاز",

    // فرنسا وتركيا
    "الدوري الفرنسي الدرجة الأولى", "كأس الدوري الفرنسي", "كأس السوبر الفرنسي", "كأس فرنسا", 
    "الدوري التركي الممتاز",

    // أمريكا والدوريات الأخرى
    "دوري كرة القدم الأميركي الممتاز", "الدوري الممتاز الكندي", "الدوري الأمريكي الممتاز للسيدات", 
    "كأس الإكوادور"
];

// تعديل هندسي: جلب التاريخ بناءً على التوقيت العالمي النقي لمنع تضارب المتصفحات
function getUTCDateString(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fixImageUrl(imgUrl, type) {
    if (!imgUrl) return '';
    if (imgUrl.startsWith('http')) return imgUrl;
    if (type === 'competition') return imgUrl.includes('country/') ? `https://img1.aiscore.com/${imgUrl}` : `https://img0.aiscore.com/football/competition/${imgUrl}`;
    return `https://img0.aiscore.com/football/team/${imgUrl}`;
}

async function runScraper() {
    console.log("🚀 بدء السحب لتخطي حماية AiScore...");
    const schemaPath = path.join(__dirname, 'aiscore_schema_final.json');
    const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const root = protobuf.Root.fromJSON(schemaJson);
    const ResponseProto = root.lookupType("onescore.app.v1.Response");
    const MatchesProto = root.lookupType("onescore.app.v1.Matches");

    const offsets = { yesterday: -1, today: 0, tomorrow: 1 };
    const finalData = { yesterday: {}, today: {}, tomorrow: {}, lastUpdate: new Date().toISOString() };

    for (const [dayName, offset] of Object.entries(offsets)) {
        const dateStr = getUTCDateString(offset);
        const targetUrl = `https://api.aiscore.com/v1/m/api/matches?lang=36&sport_id=1&date=${dateStr}&tz=00:00`;
        console.log(`⏳ جلب بيانات: ${dayName} (${dateStr})`);

        try {
            const response = await gotScraping({
                url: targetUrl,
                responseType: 'buffer', 
                headers: { 'Accept': 'application/x-protobuf' }
            });

            const outerDecoded = ResponseProto.decode(response.body);
            const responseObj = ResponseProto.toObject(outerDecoded, { bytes: Array, defaults: true });
            
            if (!responseObj.data || responseObj.data.length === 0) continue;

            const innerDecoded = MatchesProto.decode(new Uint8Array(responseObj.data));
            const matchesObj = MatchesProto.toObject(innerDecoded, { defaults: true });
            
            let rawMatches = matchesObj.matches || matchesObj.match || [];
            const teamsMap = {}; (matchesObj.teams || []).forEach(t => teamsMap[t.id] = t);
            const compsMap = {}; (matchesObj.competitions || []).forEach(c => compsMap[c.id] = c);

            let grouped = {};
            rawMatches.forEach(m => {
                const compName = compsMap[m.competition?.id]?.name || m.competition?.name || m.leagueName || "";
                if (!compName) return;

                if (targetLeagues.some(t => compName.includes(t))) {
                    const compLogo = fixImageUrl(compsMap[m.competition?.id]?.logo || m.competition?.logo || "", 'competition');
                    let hTeamObj = teamsMap[m.homeTeam?.id] || m.homeTeam || m.home || {};
                    let aTeamObj = teamsMap[m.awayTeam?.id] || m.awayTeam || m.away || {};

                    let t1Score = m.homeScores?.[0] !== undefined ? m.homeScores[0] : (m.homeScore || '-');
                    let t2Score = m.awayScores?.[0] !== undefined ? m.awayScores[0] : (m.awayScore || '-');
                    let t1Pen = m.homeScores?.[6] !== undefined ? m.homeScores[6] : null;
                    let t2Pen = m.awayScores?.[6] !== undefined ? m.awayScores[6] : null;
                    const pen1Html = t1Pen !== null && t1Pen > 0 ? `<span class="stk-pen">(${t1Pen})</span>` : '';
                    const pen2Html = t2Pen !== null && t2Pen > 0 ? `<span class="stk-pen">(${t2Pen})</span>` : '';

                    // نرسل البيانات الخام بالكامل للمتصفح وهو يتكفل بحساب العداد الحقيقي تلقائياً
                    const matchTimeMs = (m.matchTime || m.time).toString().length <= 10 ? (m.matchTime || m.time) * 1000 : (m.matchTime || m.time);
                    const matchTimeStr = new Date(matchTimeMs).toLocaleTimeString('ar-EG', { hour: '2-digit', minute:'2-digit' });

                    if (!grouped[compName]) grouped[compName] = { logo: compLogo, matches: [] };
                    
                    grouped[compName].matches.push({
                        id: m.id,
                        t1: hTeamObj.name || m.homeName,
                        t2: aTeamObj.name || m.awayName,
                        t1Logo: fixImageUrl(hTeamObj.logo, 'team'),
                        t2Logo: fixImageUrl(aTeamObj.logo, 'team'),
                        time: matchTimeStr,
                        score1: t1Score,
                        score2: t2Score,
                        pen1: pen1Html,
                        pen2: pen2Html,
                        rawMatchData: m // تمرير الكائن الخام لكي يقرأه الـ MQTT والعداد في المتصفح فوراً
                    });
                }
            });
            
            finalData[dayName] = grouped;
            console.log(`✅ نجاح! تم تجهيز مباريات ${dayName}.`);
        } catch (error) {
            console.error(`❌ خطأ في جلب ${dayName}:`, error.message);
        }
    }

    fs.writeFileSync(path.join(__dirname, 'api.json'), JSON.stringify(finalData, null, 2));
    console.log("💾 تمت العملية بنجاح!");
}

runScraper();
