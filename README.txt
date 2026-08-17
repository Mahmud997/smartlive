# Сайрам Live V4 — исправленная полная версия

Сохранены основные функции текущего проекта:
- главная;
- поиск;
- категории;
- избранное;
- профиль;
- Google/Firebase Authentication;
- демо-вход;
- объявления;
- такси + карта;
- уведомления;
- админ-раздел;
- PWA.

## ВАЖНО: Firebase
В Firebase Console:
1. Authentication -> Sign-in method -> Google -> Enable.
2. Authentication -> Settings -> Authorized domains.
3. Добавьте:
   mahmud997.github.io

Для GitHub Pages не добавляйте весь URL `/smartlive/` как домен.

## GitHub Pages
Все файлы должны находиться в корне publishing source:
index.html
style.css
app.js
firebase-auth.js
sw.js
manifest.webmanifest
icon-192.png
icon-512.png

## После загрузки
1. Откройте:
   https://mahmud997.github.io/smartlive/
2. Нажмите Ctrl+F5.
3. Если раньше сайт был установлен как PWA и показывал только SL:
   удалите старый ярлык приложения и откройте сайт обычной вкладкой Chrome один раз.
4. Нажмите Профиль -> Войти -> Войти через Google.

## Почему исправлена авторизация
app.js и firebase-auth.js — разные JavaScript-модули. ES module не имеет прямого доступа к lexical-переменным app.js. Поэтому V4 использует window.SairamLive как безопасный мост между приложением и Firebase.

## Service Worker
V4 сначала очищает старый кэш и регистрацию, затем устанавливает новый worker.
Firebase/Google OAuth URL worker не перехватывает.
