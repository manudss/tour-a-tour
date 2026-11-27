# Tour à tour

> Chacun sa bulle de parole. À qui le tour ?

Nom d'affichage choisi par Emmanuel. Le dépôt et le package Android (`app.tourdeparole`) gardent leur nom technique d'origine. Disponibilité du nom (marque, boutique d'applications) non vérifiée.

Application Android ludique pour partager le temps de parole autour d'une table. Un seul téléphone posé sur la table, on touche la bulle de la personne qui parle.

## Ce que fait l'application
- Personnes enregistrées : prénom, avatar dessiné (enfant, ado, adulte, aîné, couleurs au choix), favori.
- Nouvelle session : les favoris sont précochés, on peut les décocher, ajouter une personne enregistrée ou un invité éphémère. Nombre de personnes libre.
- En direct : bulles dont la taille suit le temps de parole, compte à rebours doux par prise (durée réglable), dépassement permis sans alarme, bouton « Personne suivante », « Passer », pause, annuler la dernière action, ajout d'une personne en cours de session. L'écran reste allumé.
- Bilan de session, puis tableau de bord (Favoris / Tous, semaine / mois / tout) avec total, moyenne par prise et nombre de prises.
- Tout reste sur le téléphone (stockage local). Aucun compte, aucun réseau.

## Règle de « Personne suivante »
La session se déroule par tours. Dans un tour, chacun passe une fois. Le bouton propose, parmi ceux qui ne sont pas encore passés dans le tour, la personne qui a le moins de temps cumulé (jamais parlé = 0:00). En cas d'égalité, celui qui attend depuis le plus longtemps. Quand tout le monde est passé, un nouveau tour commence et tout le monde est reproposé. Toucher une bulle compte comme un passage. « Passer » propose la personne suivante sans compter. Le score d'équilibre n'existe pas dans cette version.

## Architecture
Interface web hors ligne (HTML, CSS, JavaScript sans dépendance) dans une coque Android minimale : une `WebView` (`MainActivity.java`) qui charge `assets/index.html`. Un pont JavaScript active `FLAG_KEEP_SCREEN_ON`. Ce n'est pas une application native Compose.
- `app/src/main/assets/logic.js` : logique pure (rotation, temps, statistiques, disposition des bulles).
- `app/src/main/assets/avatar.js` : avatars SVG.
- `app/src/main/assets/app.js` : écrans et événements. Pas de `confirm()` natif, uniquement des dialogues dans la page.
- `scripts/build-apk.sh` : construit et signe l'APK sans Gradle (aapt2, javac, d8, zipalign, apksigner).

## Commandes
```
npm install          # puppeteer-core pour les tests d'interface (Chrome requis)
npm test             # tests de logique + test d'interface sur écran de téléphone
npm run build:apk    # génère build/tour-de-parole.apk (JDK 17 + SDK Android 36)
bash scripts/build-aab.sh   # génère build/tour-a-tour.aab pour Google Play (bundletool)
```
`npm test` produit des captures dans `/tmp/shots` (variable `SHOTS`).

## Installer
Copier `tour-de-parole.apk` sur le téléphone et l'ouvrir (autoriser les sources inconnues). L'APK est signé avec une clé de débogage créée localement dans `keystore/` (ignorée par git). Aucun secret dans le dépôt.

## État des tests
Testé : logique (node:test) et interface dans Chrome en format téléphone, horloge simulée. L'APK est construit, signé et vérifié (`apksigner verify`, `aapt2 dump badging`) mais pas encore lancé sur un appareil ou un émulateur.

## Intégration continue
Le workflow `.github/workflows/android.yml` construit l'APK et le teste sur un émulateur Android (API 34) : démarrage, pont Android, écran allumé, données conservées après arrêt complet.

## Releases
Chaque PR fusionnée dans `main` publie automatiquement une release GitHub (APK + AAB) si les tests sont verts. Détails, clé de signature et préparation Google Play: `scripts/RELEASES.md`.
