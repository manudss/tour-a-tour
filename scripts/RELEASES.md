# Releases de Tour à tour

## Fonctionnement
- Chaque PR fusionnée dans `main` par le propriétaire déclenche le workflow `android` (tests de logique, build APK + AAB, test sur émulateurs Android 14 et 16, test de mise à jour par-dessus la version précédente).
- Si, et seulement si, ce workflow est vert sur le commit de fusion exact, le job `publish` de `android.yml` publie une release GitHub stable `v1.0.N` avec:
  `tour-a-tour.apk` (nom fixe, lien `releases/latest/download/tour-a-tour.apk`), `tour-a-tour-1.0.N.apk`, `tour-a-tour-1.0.N.aab` (pour Google Play) et `SHA256SUMS.txt`.
- Versions: `1.0.N`, code Android `100000 + N`. N = plus grand N existant + 1 (brouillons réservés, pré-releases `-test` ignorées). Un commit déjà publié garde sa version. Une release existante n'est jamais remplacée. La release est créée en brouillon, publiée seulement après envoi complet des fichiers.
- Aucun push direct, aucune PR non fusionnée, aucun build rouge ne publie.
- Le workflow refuse de publier si la clé de signature est absente (jamais de clé de débogage) ou si l'empreinte du certificat n'est pas celle épinglée.
- Les notes de release reprennent le titre et la description de la PR fusionnée.
- Pré-releases de test (`vX-test`): sur demande explicite seulement, publiées à la main.

Note: le job de publication vit dans `android.yml` (et non dans un workflow `workflow_run`), car un déclencheur `workflow_run` ne fonctionne que si le fichier est sur la branche par défaut du dépôt, ici `feat/app-v1` et non `main`.

## Ce que garde le propriétaire
- La fusion des PR et la mise en ligne sur Google Play (envoi de l'AAB, fiche, déclarations, soumission à l'examen).

## Clé de signature (important)
- Certificat SHA-256: `38eeacf52a9de483f4ea294f694d97c715ab47172f0b6d080454a05b6a4ab40f`.
- Secrets du dépôt GitHub: `TDP_KEYSTORE_B64` (fichier de clé en base64) et `TDP_KEYSTORE_PASS`. Les secrets GitHub ne se relisent pas: ils ne sont pas une sauvegarde.
- Aucune clé dans le dépôt. Perdre la clé = impossible de publier une mise à jour qui s'installe par-dessus les versions GitHub existantes (désinstallation obligatoire).
- Google Play: activer « Signature d'application par Google Play » à la première publication. La clé ci-dessus sert alors de clé d'envoi: si elle est perdue, Google permet de la réinitialiser. Les APK installés depuis GitHub restent signés avec cette clé et ne se mettent pas à jour par-dessus l'installation du Store (signatures différentes).
- Une sauvegarde indépendante du fichier de clé doit être faite par le propriétaire dans un endroit sûr (gestionnaire de mots de passe avec pièce jointe, ou coffre chiffré).

## Android 36
`targetSdk` 36 (exigé par Google Play depuis le 31 août 2026). L'application gère l'affichage bord à bord d'Android 15+ (marges des barres système, de l'encoche et du clavier dans `MainActivity`).

## Préparer Google Play
Voir `docs/play-store/fiche-fr.md` (textes, déclarations, visuels) et `docs/confidentialite.html` (politique de confidentialité à héberger sur une URL publique).
