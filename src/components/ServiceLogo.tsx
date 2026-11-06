import React, { useState } from 'react';
import {
  Gamepad2,
  Car,
  Utensils,
  CreditCard,
  Trophy,
  Play,
  Users,
  MessageSquare,
  ShoppingBag,
  Bot,
  Heart,
  Radio,
  Plane,
  Smartphone
} from 'lucide-react';

export interface ServiceLogoProps {
  serviceId: string;
  serviceName?: string;
  category?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

// Canonical domain overrides for Virtual SMS services
export const SERVICE_DOMAINS: Record<string, string> = {
  // Directly requested in prompt & screenshots
  'uber': 'uber.com',
  'uber-eats': 'ubereats.com',
  'steam': 'steampowered.com',
  'bet365': 'bet365.com',
  'bigo-live': 'bigo.tv',
  'bigolive': 'bigo.tv',
  'bigo': 'bigo.tv',
  'bilibili': 'bilibili.com',
  'bird': 'bird.co',
  '1xbet': '1xbet.com',
  '99': '99app.com',
  'activision': 'activision.com',
  'bhim': 'bhimupi.org.in',

  // Messaging & Social
  'telegram': 'telegram.org',
  'tg': 'telegram.org',
  'whatsapp': 'whatsapp.com',
  'wa': 'whatsapp.com',
  'google': 'google.com',
  'go': 'google.com',
  'openai': 'openai.com',
  'oi': 'openai.com',
  'dr': 'openai.com',
  'facebook': 'facebook.com',
  'fb': 'facebook.com',
  'instagram': 'instagram.com',
  'ig': 'instagram.com',
  'tiktok': 'tiktok.com',
  'tk': 'tiktok.com',
  'lf': 'tiktok.com',
  'twitter': 'x.com',
  'tw': 'x.com',
  'x': 'x.com',
  'of': 'x.com',
  'discord': 'discord.com',
  'ds': 'discord.com',
  'youtube': 'youtube.com',
  'ytb': 'youtube.com',
  'snapchat': 'snapchat.com',
  'fu': 'snapchat.com',
  'messenger': 'messenger.com',
  'msg': 'messenger.com',
  'wechat': 'wechat.com',
  'wb': 'wechat.com',
  'linkedin': 'linkedin.com',
  'tn': 'linkedin.com',
  'reddit': 'reddit.com',
  'rd': 'reddit.com',
  'signal': 'signal.org',
  'we': 'signal.org',
  'viber': 'viber.com',
  'vi': 'viber.com',
  'line': 'line.me',
  'me': 'line.me',
  'kakaotalk': 'kakaocorp.com',
  'kk': 'kakaocorp.com',
  'kakaopay': 'kakaopay.com',
  'zalo': 'zalo.me',
  'imo': 'imo.im',
  'vk': 'vk.com',
  'qq': 'qq.com',
  'weibo': 'weibo.com',
  'threads': 'threads.net',
  'pinterest': 'pinterest.com',
  'pt': 'pinterest.com',
  'tumblr': 'tumblr.com',
  'skype': 'skype.com',
  'truecaller': 'truecaller.com',
  'odnoklassniki': 'ok.ru',
  'botim': 'botim.me',
  'tamtam': 'tamtam.chat',
  'session': 'getsession.org',
  'threema': 'threema.ch',
  'element': 'element.io',
  'mastodon': 'joinmastodon.org',
  'bluesky': 'bsky.app',
  'rumble': 'rumble.com',
  'truth-social': 'truthsocial.com',
  'bereal': 'bereal.com',
  'xiaohongshu': 'xiaohongshu.com',
  'douyin': 'douyin.com',
  'kwai': 'kwai.com',
  'likee': 'likee.video',
  'yalla': 'yalla.live',

  // Streaming & Entertainment
  'netflix': 'netflix.com',
  'nf': 'netflix.com',
  'spotify': 'spotify.com',
  'twitch': 'twitch.tv',
  'disney-plus': 'disneyplus.com',
  'prime-video': 'primevideo.com',
  'apple-tv': 'apple.com',
  'paramount-plus': 'paramountplus.com',
  'peacock': 'peacocktv.com',
  'hulu': 'hulu.com',
  'crunchyroll': 'crunchyroll.com',
  'deezer': 'deezer.com',
  'soundcloud': 'soundcloud.com',
  'audiomack': 'audiomack.com',
  'vimeo': 'vimeo.com',
  'tidal': 'tidal.com',
  'sonyliv': 'sonyliv.com',
  'zee5': 'zee5.com',
  'viu': 'viu.com',
  'iqiyi': 'iq.com',
  'tencent-video': 'v.qq.com',

  // Gaming
  'roblox': 'roblox.com',
  'epic-games': 'epicgames.com',
  'riot-games': 'riotgames.com',
  'blizzard': 'blizzard.com',
  'playstation': 'playstation.com',
  'xbox': 'xbox.com',
  'ea': 'ea.com',
  'nintendo': 'nintendo.com',
  'pubg-mobile': 'pubgmobile.com',
  'free-fire': 'ff.garena.com',
  'garena': 'garena.com',
  'mobile-legends': 'mobilelegends.com',
  'call-of-duty-mobile': 'callofduty.com',
  'honor-of-kings': 'honorofkings.com',
  'rockstar-games': 'rockstargames.com',
  'ubisoft': 'ubisoft.com',
  'supercell': 'supercell.com',
  'zynga': 'zynga.com',
  'nexon': 'nexon.com',
  'gog': 'gog.com',
  'vk-play': 'vkplay.ru',
  'hoyoverse': 'hoyoverse.com',
  'minecraft': 'minecraft.net',

  // Finance, Wallets & Crypto
  'paypal': 'paypal.com',
  'ts': 'paypal.com',
  'binance': 'binance.com',
  'cash-app': 'cash.app',
  'coinbase': 'coinbase.com',
  'wise': 'wise.com',
  'revolut': 'revolut.com',
  'skrill': 'skrill.com',
  'neteller': 'neteller.com',
  'stripe': 'stripe.com',
  'zelle': 'zellepay.com',
  'venmo': 'venmo.com',
  'payoneer': 'payoneer.com',
  'chipper-cash': 'chippercash.com',
  'opay': 'opayweb.com',
  'palmpay': 'palmpay.com',
  'kuda': 'kuda.com',
  'chime': 'chime.com',
  'crypto-com': 'crypto.com',
  'kraken': 'kraken.com',
  'bybit': 'bybit.com',
  'okx': 'okx.com',
  'kucoin': 'kucoin.com',
  'bitget': 'bitget.com',
  'gate-io': 'gate.io',
  'mexc': 'mexc.com',
  'metamask': 'metamask.io',
  'trust-wallet': 'trustwallet.com',
  'exodus': 'exodus.com',
  'ledger': 'ledger.com',
  'blockchain-com': 'blockchain.com',
  'bitfinex': 'bitfinex.com',
  'bitstamp': 'bitstamp.net',
  'poloniex': 'poloniex.com',
  'robinhood': 'robinhood.com',
  'monzo': 'monzo.com',
  'n26': 'n26.com',
  'starling': 'starlingbank.com',
  'paytm': 'paytm.com',
  'phonepe': 'phonepe.com',
  'google-pay': 'google.com',
  'apple-pay': 'apple.com',
  'mercado-pago': 'mercadopago.com',
  'm-pesa': 'safaricom.co.ke',
  'flutterwave': 'flutterwave.com',
  'remitly': 'remitly.com',
  'western-union': 'westernunion.com',

  // Rides & Mobility
  'bolt': 'bolt.eu',
  'grab': 'grab.com',
  'lyft': 'lyft.com',
  'careem': 'careem.com',
  'indrive': 'indrive.com',
  'didi': 'didiglobal.com',
  'gojek': 'gojek.com',
  'ola': 'olacabs.com',
  'rapido': 'rapido.bike',
  'yandex-go': 'go.yandex',
  'whoosh': 'whoosh.bike',
  'tier': 'tier.app',
  'lime': 'li.me',
  'citymapper': 'citymapper.com',
  'blablacar': 'blablacar.com',
  'turo': 'turo.com',

  // Delivery & Food
  'doordash': 'doordash.com',
  'deliveroo': 'deliveroo.com',
  'glovo': 'glovoapp.com',
  'rappi': 'rappi.com',
  'foodpanda': 'foodpanda.com',
  'wolt': 'wolt.com',
  'just-eat': 'just-eat.com',
  'swiggy': 'swiggy.com',
  'zomato': 'zomato.com',
  'blinkit': 'blinkit.com',
  'zepto': 'zeptonow.com',
  'grubhub': 'grubhub.com',
  'instacart': 'instacart.com',
  'mcdonalds': 'mcdonalds.com',
  'burger-king': 'bk.com',
  'kfc': 'kfc.com',
  'subway': 'subway.com',
  'dominos': 'dominos.com',
  'pizza-hut': 'pizzahut.com',
  'starbucks': 'starbucks.com',
  'dunkin': 'dunkindonuts.com',

  // Marketplace & E-commerce
  'amazon': 'amazon.com',
  'am': 'amazon.com',
  'ebay': 'ebay.com',
  'dh': 'ebay.com',
  'aliexpress': 'aliexpress.com',
  'alx': 'aliexpress.com',
  'shopee': 'shopee.com',
  'ka': 'shopee.com',
  'temu': 'temu.com',
  'tmu': 'temu.com',
  'shein': 'shein.com',
  'walmart': 'walmart.com',
  'target': 'target.com',
  'best-buy': 'bestbuy.com',
  'costco': 'costco.com',
  'mercado-libre': 'mercadolibre.com',
  'lazada': 'lazada.com',
  'tokopedia': 'tokopedia.com',
  'flipkart': 'flipkart.com',
  'taobao': 'taobao.com',
  'jd': 'jd.com',
  'pinduoduo': 'pinduoduo.com',
  'etsy': 'etsy.com',
  'vinted': 'vinted.com',
  'poshmark': 'poshmark.com',
  'depop': 'depop.com',
  'mercari': 'mercari.com',
  'wildberries': 'wildberries.ru',
  'ozon': 'ozon.ru',
  'allegro': 'allegro.pl',
  'olx': 'olx.com',
  'avito': 'avito.ru',
  'carousell': 'carousell.com',
  'craigslist': 'craigslist.org',
  'gumtree': 'gumtree.com',
  'leboncoin': 'leboncoin.fr',
  'zara': 'zara.com',
  'hm': 'hm.com',
  'nike': 'nike.com',
  'adidas': 'adidas.com',
  'uniqlo': 'uniqlo.com',
  'zalando': 'zalando.com',
  'asos': 'asos.com',

  // AI & Productivity
  'claude': 'claude.ai',
  'gemini': 'google.com',
  'apple': 'apple.com',
  'wx': 'apple.com',
  'microsoft': 'microsoft.com',
  'mm': 'microsoft.com',
  'microsoft-teams': 'microsoft.com',
  'google-meet': 'google.com',
  'slack': 'slack.com',
  'zoom': 'zoom.us',
  'notion': 'notion.so',
  'canva': 'canva.com',
  'figma': 'figma.com',
  'github': 'github.com',
  'gitlab': 'gitlab.com',
  'linear': 'linear.app',
  'clickup': 'clickup.com',
  'asana': 'asana.com',
  'trello': 'trello.com',
  'airtable': 'airtable.com',
  'character-ai': 'character.ai',
  'midjourney': 'midjourney.com',
  'leonardo-ai': 'leonardo.ai',
  'perplexity': 'perplexity.ai',
  'copilot': 'microsoft.com',
  'deepseek': 'deepseek.com',
  'hugging-face': 'huggingface.co',
  'duolingo': 'duolingo.com',

  // Dating
  'tinder': 'tinder.com',
  'bumble': 'bumble.com',
  'hinge': 'hinge.co',
  'badoo': 'badoo.com',
  'grindr': 'grindr.com',
  'happn': 'happn.com',
  'match': 'match.com',
  'plenty-of-fish': 'pof.com',
  'coffee-meets-bagel': 'coffeemeetsbagel.com',

  // Travel & Airlines
  'airbnb': 'airbnb.com',
  'booking': 'booking.com',
  'tripadvisor': 'tripadvisor.com',
  'expedia': 'expedia.com',
  'agoda': 'agoda.com',
  'kayak': 'kayak.com',
  'skyscanner': 'skyscanner.net',
  'emirates': 'emirates.com',
  'qatar-airways': 'qatarairways.com',
  'ryanair': 'ryanair.com',
  'easyjet': 'easyjet.com',
  'wizz-air': 'wizzair.com',
  'lufthansa': 'lufthansa.com',
  'turkish-airlines': 'turkishairlines.com',
  'redbus': 'redbus.in',
  'trainline': 'thetrainline.com',
  'klook': 'klook.com',

  // Adult / Creator
  'onlyfans': 'onlyfans.com',
  'patreon': 'patreon.com',
  'fansly': 'fansly.com'
};

// Resolver from serviceId / serviceName to canonical domain
export const getServiceDomain = (serviceId: string, serviceName?: string): string => {
  const cleanId = (serviceId || '').toLowerCase().trim();
  if (SERVICE_DOMAINS[cleanId]) return SERVICE_DOMAINS[cleanId];

  const cleanName = (serviceName || '').toLowerCase().trim();
  if (SERVICE_DOMAINS[cleanName]) return SERVICE_DOMAINS[cleanName];

  const noHyphen = cleanId.replace(/-/g, '');
  if (SERVICE_DOMAINS[noHyphen]) return SERVICE_DOMAINS[noHyphen];

  const nameNoSpace = cleanName.replace(/[^a-z0-9]/g, '');
  if (SERVICE_DOMAINS[nameNoSpace]) return SERVICE_DOMAINS[nameNoSpace];

  return `${noHyphen || cleanId || 'service'}.com`;
};

// Vector SVG Logos for Top Global Brands
export const KNOWN_VECTOR_LOGOS: Record<string, React.ReactNode> = {
  // 1. Uber
  'uber': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <span className="text-[8px] font-black tracking-tight text-white font-sans uppercase">UBER</span>
    </div>
  ),
  'uber-eats': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <span className="text-[7px] font-black tracking-tight text-[#06C167] font-sans uppercase">EATS</span>
    </div>
  ),

  // 2. Steam
  'steam': (
    <div className="w-full h-full bg-[#171a21] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
        <path d="M11.979 0C5.378 0 0 5.373 0 11.979c0 5.08 3.167 9.423 7.64 11.162l3.414-4.992c-.171-.462-.266-.961-.266-1.484 0-.435.066-.855.187-1.251L7.26 12.016a3.86 3.86 0 0 1-.954.12 3.863 3.863 0 1 1 3.863-3.863c0 .324-.04.638-.114.941l3.398 2.378c.396-.121.815-.187 1.251-.187 2.134 0 3.863 1.73 3.863 3.863 0 2.134-1.73 3.863-3.863 3.863-.523 0-1.022-.095-1.484-.266l-4.992 3.414A11.95 11.95 0 0 0 11.979 24c6.606 0 11.979-5.373 11.979-11.979C23.958 5.373 18.585 0 11.979 0z" />
      </svg>
    </div>
  ),

  // 3. bet365
  'bet365': (
    <div className="w-full h-full bg-[#006644] rounded-md flex items-center justify-center px-0.5">
      <span className="text-[8px] font-black tracking-tighter text-white font-sans">
        bet<span className="text-[#f6e300]">365</span>
      </span>
    </div>
  ),

  // 4. Bigo Live
  'bigo-live': (
    <div className="w-full h-full bg-[#00D2D3] rounded-md flex items-center justify-center p-0.5">
      <span className="text-[7.5px] font-black text-white tracking-tighter font-sans uppercase">BIGO</span>
    </div>
  ),

  // 5. Bilibili
  'bilibili': (
    <div className="w-full h-full bg-[#00A1D6] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
        <path d="M17.813 4.653h.854c1.51 0 2.733 1.224 2.733 2.734v10.14c0 1.51-1.223 2.734-2.733 2.734H5.333c-1.51 0-2.733-1.224-2.733-2.734V7.387c0-1.51 1.223-2.734 2.733-2.734h.854L4.31 2.776a.683.683 0 1 1 .966-.966l3.056 3.056h7.336L18.724 1.81a.683.683 0 1 1 .966.966l-1.877 1.877zM7.387 10.12a1.367 1.367 0 1 0 0 2.733 1.367 1.367 0 0 0 0-2.733zm9.226 0a1.367 1.367 0 1 0 0 2.733 1.367 1.367 0 0 0 0-2.733z" />
      </svg>
    </div>
  ),

  // 6. 1xBet
  '1xbet': (
    <div className="w-full h-full bg-[#1A568C] rounded-md flex items-center justify-center px-0.5">
      <span className="text-[8px] font-black tracking-tighter text-white font-sans">
        1X<span className="text-[#00BCD4]">BET</span>
      </span>
    </div>
  ),

  // 7. 99 (Mobility)
  '99': (
    <div className="w-full h-full bg-[#FFDF00] rounded-md flex items-center justify-center">
      <span className="text-[10px] font-black text-black font-sans tracking-tighter">99</span>
    </div>
  ),

  // 8. Activision
  'activision': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <span className="text-[7.5px] font-black tracking-tighter text-white font-sans">ACTI</span>
    </div>
  ),

  // 9. BHIM (UPI)
  'bhim': (
    <div className="w-full h-full bg-white border border-[#E9E2FA] rounded-md flex items-center justify-center p-0.5">
      <span className="text-[7.5px] font-black tracking-tighter font-sans">
        <span className="text-[#FF9933]">BH</span>
        <span className="text-[#138808]">IM</span>
      </span>
    </div>
  ),

  // 10. Bird
  'bird': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <span className="text-[8px] font-black text-white font-sans tracking-tight">BIRD</span>
    </div>
  ),

  // Telegram
  'telegram': (
    <div className="w-full h-full bg-[#229ED9] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    </div>
  ),

  // WhatsApp
  'whatsapp': (
    <div className="w-full h-full bg-[#25D366] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
      </svg>
    </div>
  ),

  // Google
  'google': (
    <div className="w-full h-full bg-white border border-[#E9E2FA] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5">
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z" />
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
      </svg>
    </div>
  ),

  // TikTok
  'tiktok': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .56.04.83.12V9.3a6.33 6.33 0 0 0-1-.08 6.26 6.26 0 1 0 6.26 6.26V9.05a8.21 8.21 0 0 0 5.02 1.74V7.33a4.84 4.84 0 0 1-1-.64z" />
      </svg>
    </div>
  ),

  // Instagram
  'instagram': (
    <div className="w-full h-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    </div>
  ),

  // Facebook
  'facebook': (
    <div className="w-full h-full bg-[#1877F2] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    </div>
  ),

  // Twitter / X
  'x': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </div>
  ),
  'twitter': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </div>
  ),

  // OpenAI / ChatGPT
  'openai': (
    <div className="w-full h-full bg-[#10A37F] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 8.784a4.47 4.47 0 0 1 2.37-2.122V12.4a.79.79 0 0 0 .392.681l5.843 3.37-2.02 1.168a.076.076 0 0 1-.067 0L4.02 14.837a4.504 4.504 0 0 1-1.68-6.053zm16.597 3.855l-5.833-3.37L15.124 8.1a.076.076 0 0 1 .067 0l4.838 2.782a4.5 4.5 0 0 1-.685 8.18v-5.748a.79.79 0 0 0-.407-.675zm2.01-3.012l-.141-.085-4.773-2.78a.776.776 0 0 0-.785 0L9.409 10.13V7.798a.08.08 0 0 1 .033-.062l4.838-2.793a4.5 4.5 0 0 1 6.67 4.316l-.004.037v-.515zM12 14.303l-2.617-1.512 2.617-1.512 2.617 1.512L12 14.303z" />
      </svg>
    </div>
  ),

  // Discord
  'discord': (
    <div className="w-full h-full bg-[#5865F2] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028z" />
      </svg>
    </div>
  ),

  // Apple
  'apple': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-1.09 1.74-.95 2.77 1.01.08 2.05-.52 2.68-1.27z" />
      </svg>
    </div>
  ),

  // Netflix
  'netflix': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <span className="text-[9px] font-black tracking-tight text-[#E50914] font-sans">N</span>
    </div>
  ),

  // Spotify
  'spotify': (
    <div className="w-full h-full bg-[#1DB954] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-black">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.485 17.309c-.215.352-.674.464-1.026.248-2.809-1.716-6.345-2.105-10.51-1.153-.403.092-.806-.159-.899-.562-.092-.403.159-.806.562-.899 4.568-1.044 8.483-.604 11.625 1.312.352.215.464.674.248 1.026zm1.465-3.256c-.27.439-.844.577-1.283.307-3.216-1.977-8.118-2.548-11.922-1.393-.497.151-1.026-.134-1.177-.631-.151-.497.134-1.026.631-1.177 4.351-1.321 9.756-.684 13.444 1.583.439.27.577.844.307 1.283zm.126-3.41c-3.856-2.29-10.218-2.502-13.882-1.39-.59.179-1.218-.156-1.397-.746-.179-.59.156-1.218.746-1.397 4.225-1.282 11.236-1.037 15.688 1.606.531.315.703 1.002.388 1.533-.315.531-1.002.703-1.533.388z" />
      </svg>
    </div>
  ),

  // PayPal
  'paypal': (
    <div className="w-full h-full bg-[#003087] rounded-md flex items-center justify-center p-0.5">
      <span className="text-[8px] font-black text-white font-sans italic">P</span>
      <span className="text-[8px] font-black text-[#0079C1] font-sans italic -ml-0.5">P</span>
    </div>
  ),

  // Binance
  'binance': (
    <div className="w-full h-full bg-[#181A20] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-[#F0B90B]">
        <path d="M12 0l-3.375 3.375L12 6.75l3.375-3.375L12 0zm-6.75 6.75L1.875 10.125 5.25 13.5l3.375-3.375L5.25 6.75zm13.5 0l-3.375 3.375L18.75 13.5l3.375-3.375L18.75 6.75zM12 8.438L8.438 12 12 15.563 15.563 12 12 8.438zM5.25 15.188L1.875 18.563 5.25 21.938l3.375-3.375L5.25 15.188zm13.5 0l-3.375 3.375 3.375 3.375 3.375-3.375L18.75 15.188zM12 17.25l-3.375 3.375L12 24l3.375-3.375L12 17.25z" />
      </svg>
    </div>
  ),

  // Roblox
  'roblox': (
    <div className="w-full h-full bg-black rounded-md flex items-center justify-center p-0.5">
      <div className="w-3 h-3 bg-white rotate-12 flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-black" />
      </div>
    </div>
  ),

  // Twitch
  'twitch': (
    <div className="w-full h-full bg-[#9146FF] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
      </svg>
    </div>
  ),

  // YouTube
  'youtube': (
    <div className="w-full h-full bg-[#FF0000] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    </div>
  ),
  'ytb': (
    <div className="w-full h-full bg-[#FF0000] rounded-md flex items-center justify-center p-0.5">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    </div>
  ),

  // Bigo Live aliases
  'bigolive': (
    <div className="w-full h-full bg-[#00D2D3] rounded-md flex items-center justify-center p-0.5">
      <span className="text-[7.5px] font-black text-white tracking-tighter font-sans uppercase">BIGO</span>
    </div>
  ),
  'bigo': (
    <div className="w-full h-full bg-[#00D2D3] rounded-md flex items-center justify-center p-0.5">
      <span className="text-[7.5px] font-black text-white tracking-tighter font-sans uppercase">BIGO</span>
    </div>
  )
};

// Category fallback icon mapping
export const getCategoryFallbackIcon = (category?: string, size = 'sm') => {
  const c = (category || '').toLowerCase();
  const iconClass = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (c.includes('gaming')) {
    return (
      <div className="w-full h-full bg-indigo-50 border border-indigo-200/80 rounded-md flex items-center justify-center text-indigo-600">
        <Gamepad2 className={iconClass} />
      </div>
    );
  }
  if (c.includes('transport') || c.includes('taxi') || c.includes('ride')) {
    return (
      <div className="w-full h-full bg-blue-50 border border-blue-200/80 rounded-md flex items-center justify-center text-blue-600">
        <Car className={iconClass} />
      </div>
    );
  }
  if (c.includes('travel') || c.includes('flight') || c.includes('hotel')) {
    return (
      <div className="w-full h-full bg-teal-50 border border-teal-200/80 rounded-md flex items-center justify-center text-teal-600">
        <Plane className={iconClass} />
      </div>
    );
  }
  if (c.includes('delivery') || c.includes('food')) {
    return (
      <div className="w-full h-full bg-amber-50 border border-amber-200/80 rounded-md flex items-center justify-center text-amber-600">
        <Utensils className={iconClass} />
      </div>
    );
  }
  if (c.includes('finance') || c.includes('bank') || c.includes('crypto')) {
    return (
      <div className="w-full h-full bg-emerald-50 border border-emerald-200/80 rounded-md flex items-center justify-center text-emerald-600">
        <CreditCard className={iconClass} />
      </div>
    );
  }
  if (c.includes('streaming') || c.includes('video') || c.includes('music')) {
    return (
      <div className="w-full h-full bg-rose-50 border border-rose-200/80 rounded-md flex items-center justify-center text-rose-600">
        <Play className={`${iconClass} fill-rose-600`} />
      </div>
    );
  }
  if (c.includes('dating')) {
    return (
      <div className="w-full h-full bg-pink-50 border border-pink-200/80 rounded-md flex items-center justify-center text-pink-600">
        <Heart className={`${iconClass} fill-pink-600`} />
      </div>
    );
  }
  if (c.includes('social')) {
    return (
      <div className="w-full h-full bg-purple-50 border border-purple-200/80 rounded-md flex items-center justify-center text-[#7C3AED]">
        <Users className={iconClass} />
      </div>
    );
  }
  if (c.includes('messaging') || c.includes('chat')) {
    return (
      <div className="w-full h-full bg-sky-50 border border-sky-200/80 rounded-md flex items-center justify-center text-sky-600">
        <MessageSquare className={iconClass} />
      </div>
    );
  }
  if (c.includes('marketplace') || c.includes('shopping')) {
    return (
      <div className="w-full h-full bg-orange-50 border border-orange-200/80 rounded-md flex items-center justify-center text-orange-600">
        <ShoppingBag className={iconClass} />
      </div>
    );
  }
  if (c.includes('ai') || c.includes('productivity')) {
    return (
      <div className="w-full h-full bg-emerald-50 border border-emerald-200/80 rounded-md flex items-center justify-center text-emerald-600">
        <Bot className={iconClass} />
      </div>
    );
  }
  if (c.includes('telecom') || c.includes('carrier')) {
    return (
      <div className="w-full h-full bg-blue-50 border border-blue-200/80 rounded-md flex items-center justify-center text-blue-600">
        <Radio className={iconClass} />
      </div>
    );
  }
  if (c.includes('betting') || c.includes('casino')) {
    return (
      <div className="w-full h-full bg-amber-50 border border-amber-200/80 rounded-md flex items-center justify-center text-amber-600">
        <Trophy className={iconClass} />
      </div>
    );
  }

  // Default clean smart fallback
  return (
    <div className="w-full h-full bg-purple-50 border border-purple-200/80 rounded-md flex items-center justify-center text-[#7C3AED]">
      <Smartphone className={iconClass} />
    </div>
  );
};

export const ServiceLogo: React.FC<ServiceLogoProps> = ({
  serviceId,
  serviceName,
  category,
  size = 'sm',
  className = ''
}) => {
  const cleanId = (serviceId || '').toLowerCase().trim();
  const [useFallback, setUseFallback] = useState(false);
  const [triedSecondary, setTriedSecondary] = useState(false);

  // Size dimensions matching existing container design
  const sizeClasses = {
    xs: 'w-5 h-5 rounded-md',
    sm: 'w-6 h-6 rounded-md',
    md: 'w-7 h-7 rounded-lg',
    lg: 'w-8 h-8 rounded-xl'
  }[size];

  // 1. Direct high-definition Vector SVG
  if (KNOWN_VECTOR_LOGOS[cleanId]) {
    return (
      <div className={`${sizeClasses} shrink-0 flex items-center justify-center overflow-hidden shadow-2xs ${className}`}>
        {KNOWN_VECTOR_LOGOS[cleanId]}
      </div>
    );
  }

  // Check alias / code in vector logos
  const aliasMatch = Object.keys(KNOWN_VECTOR_LOGOS).find(k => cleanId.includes(k) || (serviceName && serviceName.toLowerCase().includes(k)));
  if (aliasMatch && !useFallback) {
    return (
      <div className={`${sizeClasses} shrink-0 flex items-center justify-center overflow-hidden shadow-2xs ${className}`}>
        {KNOWN_VECTOR_LOGOS[aliasMatch]}
      </div>
    );
  }

  // 2. Fallback icon if CDN failed
  if (useFallback) {
    return (
      <div className={`${sizeClasses} shrink-0 flex items-center justify-center overflow-hidden shadow-2xs ${className}`}>
        {getCategoryFallbackIcon(category, size)}
      </div>
    );
  }

  // 3. Official High-Resolution Favicon CDN (Google Favicon 128px with DuckDuckGo fallback)
  const domain = getServiceDomain(cleanId, serviceName);
  const logoUrl = triedSecondary
    ? `https://icons.duckduckgo.com/ip3/${domain}.ico`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <div className={`${sizeClasses} shrink-0 flex items-center justify-center overflow-hidden bg-white border border-[#E9E2FA]/80 p-0.5 shadow-2xs ${className}`}>
      <img
        src={logoUrl}
        alt={serviceName || serviceId}
        loading="lazy"
        className="w-full h-full object-contain rounded-xs"
        onError={() => {
          if (!triedSecondary) {
            setTriedSecondary(true);
          } else {
            setUseFallback(true);
          }
        }}
      />
    </div>
  );
};

export default ServiceLogo;
