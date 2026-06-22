const fs = require('fs');
const path = require('path');
const protobuf = require('protobufjs');

// 1. البطولات المستهدفة
const targetLeagues = [
    "كأس العالم", "كأس أمم أفريقيا", "دوري أبطال أفريقيا", "دوري أبطال أوروبا", 
    "الدوري الإنجليزي الممتاز", "الدوري الإسباني الدرجة الأولى", "الدوري الإيطالي الدرجة الأولى", 
    "الدوري الألماني", "الدوري المصري الممتاز", "الدوري السعودي للمحترفين", "دوري نجوم العراق", "الدوري المغربي الإحترافي إنوي"
];

// 2. دالة لضبط التاريخ بتوقيت القاهرة
function getCairoDateString(offsetDays) {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function fixImageUrl(imgUrl, type) {
    if (!imgUrl) return '';
    if (imgUrl.startsWith('http')) return imgUrl;
    if (type === 'competition') return imgUrl.includes('country/') ? `https://img1.aiscore.com/${imgUrl}` : `https://img0.aiscore.com/football/competition/${imgUrl}`;
    return `https://img0.aiscore.com/football/team/${imgUrl}`;
}

function getMatchMetaData(m) {
    let sId = m.statusId !== undefined ? m.statusId : (m.status || 0);
    const times = m.times || {};
    let statusText = "لم تبدأ"; let timer = ""; let sClass = "not-started";
    let tmrSecs = times.tmrSecs || 0;
    let tmrUpdated = times.tmrUpdated || 0;
    let ticking = times.ticking || 0;

    let liveSeconds = 0;
    if (ticking === 1 && tmrUpdated > 0) {
        liveSeconds = Math.floor(Date.now() / 1000) - tmrUpdated;
        if (liveSeconds < 0 || liveSeconds > 7200) liveSeconds = 0;
    }
    let totalSeconds = tmrSecs + liveSeconds;
    let mins = Math.floor(totalSeconds / 60);

    switch (sId) {
        case 0: case 1: statusText = "لم تبدأ"; sClass = "not-started"; break;
        case 2: statusText = "الشوط الأول"; sClass = "live"; timer = mins >= 45 ? `45+${mins - 45 + 1}'` : `${mins + 1}'`; break;
        case 3: statusText = "بين الشوطين"; sClass = "live"; break;
        case 4: statusText = "الشوط الثاني"; sClass = "live"; timer = mins >= 90 ? `90+${mins - 90 + 1}'` : `${mins + 1}'`; break;
        case 5: sClass = "live"; if (mins < 105) { statusText = "شوط إضافي أول"; timer = `${mins + 1}'`; } else { statusText = "شوط إضافي ثاني"; timer = mins >= 120 ? `120+${mins - 120 + 1}'` : `${mins + 1}'`; } break;
        case 6: statusText = "استراحة إضافي"; sClass = "live"; break;
        case 7: case 50: statusText = "ركلات ترجيح"; sClass = "live"; break;
        case 8: statusText = "انتهت"; sClass = "ended"; break;
        case 9: case 13: statusText = "مؤجلة"; sClass = "postponed"; break;
        case 10: case 11: statusText = "توقف"; sClass = "live"; break;
        case 12: statusText = "إلغاء"; sClass = "cancelled"; break;
        default: statusText = ticking === 1 ? "مباشر" : "لم تبدأ"; sClass = ticking === 1 ? "live" : "not-started"; timer = ticking === 1 ? `${mins + 1}'` : "";
    }
    let timerHtml = sClass === 'live' ? (timer ? `<span class="stk-live-dot"></span> <span dir="ltr">${timer}</span>` : `<span class="stk-live-dot"></span>`) : '';
    return { statusText, sClass, timerHtml };
}

async function runScraper() {
    console.log("🚀 بدء السحب لتخطي حماية AiScore...");
    
    // 🔥 الخدعة الذكية: استدعاء المكتبة ديناميكياً لتخطي أخطاء التوافق 🔥
    const { gotScraping } = await import('got-scraping');

    const schemaPath = path.join(__dirname, 'aiscore_schema_final.json');
    const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const root = protobuf.Root.fromJSON(schemaJson);
    const ResponseProto = root.lookupType("onescore.app.v1.Response");
    const MatchesProto = root.lookupType("onescore.app.v1.Matches");

    const offsets = { yesterday: -1, today: 0, tomorrow: 1 };
    const finalData = { yesterday: {}, today: {}, tomorrow: {}, lastUpdate: new Date().toISOString() };

    for (const [dayName, offset] of Object.entries(offsets)) {
        const dateStr = getCairoDateString(offset);
        const targetUrl = `https://api.aiscore.com/v1/m/api/matches?lang=36&sport_id=1&date=${dateStr}&tz=02:00`;
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

                    const meta = getMatchMetaData(m);
                    const isPending = ["لم تبدأ", "تأجلت", "إلغاء", "مؤجلة"].includes(meta.statusText);
                    
                    const matchTimeMs = (m.matchTime || m.time).toString().length <= 10 ? (m.matchTime || m.time) * 1000 : (m.matchTime || m.time);
                    const matchTimeStr = new Date(matchTimeMs).toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute:'2-digit' });

                    if (!grouped[compName]) grouped[compName] = { logo: compLogo, matches: [] };
                    
                    grouped[compName].matches.push({
                        id: m.id, t1: hTeamObj.name || m.homeName, t2: aTeamObj.name || m.awayName,
                        t1Logo: fixImageUrl(hTeamObj.logo, 'team'), t2Logo: fixImageUrl(aTeamObj.logo, 'team'),
                        time: matchTimeStr, score1: isPending ? '-' : t1Score, score2: isPending ? '-' : t2Score,
                        pen1: pen1Html, pen2: pen2Html, ...meta
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
    console.log("💾 تمت العملية بنجاح! تم حفظ البيانات المفلترة في api.json");
}

runScraper();
