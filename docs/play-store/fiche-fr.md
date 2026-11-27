# Fiche Google Play, Tour à tour (français)

Texte prêt à coller dans la Play Console. À valider par le propriétaire avant tout envoi.

- **Nom de l'appli** (30 car. max): Tour à tour
- **Description courte** (80 car. max): Partagez la parole autour d'une table, en jouant. Sans compte, hors ligne.
- **Catégorie proposée**: Outils (ou Éducation, au choix du propriétaire)
- **Contact public**: à confirmer par le propriétaire (adresse e-mail et site, obligatoires dans la Console)
- **Politique de confidentialité**: `docs/confidentialite.html` (URL publique à confirmer: GitHub Pages ou autre hébergement)

## Description complète

Chacun sa bulle de parole. À qui le tour ?

Tour à tour est une petite appli ludique pour partager le temps de parole autour d'une table: repas de famille, réunion, jeu, classe, atelier.

Chaque personne a sa bulle avec un personnage dessiné. Touchez une bulle pour donner la parole: un compte à rebours doux démarre, un anneau se remplit, et si on dépasse, un arc rouge repart par-dessus sans alarme ni jugement. « Personne suivante » propose celle ou celui qui a le moins parlé.

- 32 personnages (enfants, ados, adultes, aînés), couleurs de peau, de cheveux et de t-shirt au choix.
- Une pastille indique le nombre de tours de chaque personne, du vert (équilibré) vers le rouge (beaucoup plus que les autres).
- Pause, reprise et fin de session avec un bilan: temps de parole, nombre de prises, qui a parlé le plus.
- Tableau de bord: toutes les sessions, par semaine, par mois ou depuis le début. Rouvrez le bilan d'une session ou supprimez-la pour la retirer des statistiques.
- L'écran reste allumé pendant une session.
- Vos personnes et vos sessions restent sur votre téléphone. Pas de compte, pas de publicité, pas de connexion internet.

## Déclarations (à enregistrer par le propriétaire dans la Console)

- Publicité: non. Achats intégrés: non. Compte utilisateur: non.
- Sécurité des données: aucune donnée collectée ni partagée. Tout est stocké localement sur l'appareil; l'application ne demande aucune permission et n'a pas accès à internet (vérifiable dans le manifeste: aucun `uses-permission`).
- Public cible: à choisir par le propriétaire. L'appli est utilisable par des enfants (personnages enfants) mais n'est pas destinée à les cibler seuls. Aucune donnée personnelle n'est collectée dans tous les cas. Décision et attestation (famille/enfants) à prendre par le propriétaire.
- Classification du contenu: questionnaire à remplir par le propriétaire (aucun contenu sensible dans l'appli).
- Identifiant de l'appli: `app.tourdeparole` (ne jamais changer).

## Visuels

- Icône: `icone-512.png` (512x512)
- Graphique de présentation: `presentation-1024x500.png`
- Captures téléphone (1080x2160, rapport 2:1): `captures/1-accueil.png` à `6-historique.png`. Personnages fictifs seulement. Régénérer: `VIEW=400x800x2.7 SHOTS=/tmp/store node tests/ui.test.js`, puis copier les captures voulues.
