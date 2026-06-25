//#region IMPORTING
require('dotenv').config();
const { Bot, InputFile } = require("grammy");
const axios = require("axios");
const cron = require("node-cron");
const { autoRetry } = require("@grammyjs/auto-retry");
const { run } = require("@grammyjs/runner");
const { limit } = require("@grammyjs/ratelimiter");
//#endregion

//#region ENV VARS
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ADMIN_ID = process.env.ADMIN_ID;
//#endregion

//#region THE BASIC VARS
const bot = new Bot(BOT_TOKEN);
//#endregion

//#region configs part
bot.api.config.use(autoRetry());
//#endregion

//#region middelware part
bot.use(
  limit({
    timeFrame: 30000,
    limit: 1,
    onLimitExceeded: async (ctx) => {
      await ctx.answerCallbackQuery();
      await bot.api.sendMessage(ctx.from.id,"⏳ انتظر نص دقيقة قبل ما تبعت تاني.");
    }
  })
);
//#endregion

//#region bot commands
bot.command("start", async(ctx)=>{
  await ctx.reply("السلام عليكم,أهلا بيك!\nفقط أقدر أبعتلك التفسيرات اللي أختارتها من القناة.");
});
//#endregion

//#region sendTheMornningMessage FUNC
async function sendTheMornningMessage(){
  function getRandomNumber(min=1, max=6236) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  let choisenAyah = getRandomNumber();
  let surahNumber, ayahNumber, surahName, ayah, tafsirName, tafsir;

  // for choise and declear the basics vars.
  await axios
  .get(`http://api.alquran.cloud/v1/ayah/${choisenAyah}`)
  .then((res)=>{
    surahNumber = res.data.data.surah.number;
    ayahNumber = res.data.data.numberInSurah;
    surahName = res.data.data.surah.name;
    ayah = res.data.data.text;
  })
  .catch((err)=>{console.log(err.message);});

  if (!surahNumber || !ayahNumber){
    console.error("Failed to fetch ayah data");
    return;
  };

  // for get and send the choisen ayah and tafsir.
  await axios
  .get(`http://api.quran-tafseer.com/tafseer/1/${surahNumber}/${ayahNumber}`)
  .then((res)=>{
    tafsirName = res.data.tafseer_name;
    tafsir = res.data.text;

    bot.api.sendMessage(CHANNEL_ID,`﴿<b>${ayah.trim()}</b>﴾ - [${surahName}:${ayahNumber}]\n${tafsir}\n- ${tafsirName}` , {
      parse_mode: "HTML",
      reply_markup : {
        inline_keyboard : [
          [
            {
              text:"ابن كثير", callback_data : `ibnkasir-${surahNumber}/${ayahNumber}`
            }
            ,{
              text:"السعدي", callback_data : `als3dy-${surahNumber}/${ayahNumber}`
            }
          ]
        ]
      }
    });

    if (!surahNumber || !ayahNumber){
      console.error("Failed to fetch ayah data");
      return;
    };

    bot.api.sendAudio(CHANNEL_ID,
      `http://khorasan.mamluk.net/public.php/dav/files/Y7cWxynjJ7EaP8t/audio/64/ar.alafasy/${choisenAyah}.mp3`
    );
  })
  .catch((err)=>{console.log(err.message);});
}
//#endregion

//#region callbackQuery listener
bot.on("callback_query:data",async(ctx)=>{
  
  const data = ctx.callbackQuery.data;
  let ayahUrlLocation , tafsirCode;
  await ctx.answerCallbackQuery();

  if(data.includes("als3dy-") || data.includes("ibnkasir-")){
    if(data.includes("als3dy-")){
      ayahUrlLocation = data.replace("als3dy-","");
      tafsirCode = "3";
    }else if(data.includes("ibnkasir-")){
      ayahUrlLocation = data.replace("ibnkasir-","");
      tafsirCode = "4";
    }

    await axios
    .get(`http://api.quran-tafseer.com/tafseer/${tafsirCode}/${ayahUrlLocation}`)
    .then((res)=>{
      const tafsirName = res.data.tafseer_name;
      const tafsir = res.data.text;

      bot.api.sendMessage(ctx.callbackQuery.from.id,`<b>${tafsir}</b>\n- ${tafsirName}` , {
        parse_mode: "HTML"
      });
    })
    .catch((err)=>{console.log(err.message);});
  }
});
//#endregion

//#region tafsir schedulling
cron.schedule("0 5 * * *", async()=>{
    sendTheMornningMessage();
  },
  {
    timezone: "Asia/Riyadh"  // ← توقيت السعودية
  }
);
//#endregion

//#region third Error wall catcher.
bot.catch(async(err)=>{
  console.log(`Error : ${err.message}`);
  await bot.api.sendMessage(ADMIN_ID, `Error : ${err.message}`);
});
//#endregion

//#region bot running code
run(bot);
//#endregion