# FruitStory — MVP

SaaS de génération de mini-séries TikTok jouées par des **personnages-fruits 3D**, pensé pour le public d'**Afrique francophone**.

- **Images** : OpenAI (GPT Image) — planches de personnages + première image de chaque plan
- **Vidéo** : xAI Grok Imagine (image → vidéo, avec voix)
- **Scénario** : OpenAI (modèle texte)
- **Montage** : ffmpeg (assemblage, format 9:16, sous-titres incrustés)

## Principe produit

- **2 questions, une seule fois** (onboarding) : compte TikTok monétisé ? + pays.
- **Création en 1 clic** : une histoire du catalogue (ou une idée en une phrase) → la vidéo est lancée.
  Le format est choisi automatiquement : **court 20-30 s** (croissance) ou **long 70 s** (monétisation, > 1 min).
  Les options (format, nombre d'épisodes, pays) sont repliées dans « Options avancées ».
- **Séries** : 1, 3, 5 ou 8 parties ; le plan de la saison est écrit une fois, puis bouton **« Épisode suivant »**.
- **Économies** : chaque personnage (pays × rôle) a une **planche générée une seule fois** et partagée entre tous les utilisateurs.
- **Crédits** : débités à la création, **remboursés automatiquement** en cas d'échec.

## Démarrage

Prérequis : Node.js ≥ 22.13 et `ffmpeg` installé.

```bash
npm install
cp .env.example .env.local   # ajoute OPENAI_API_KEY et XAI_API_KEY
npm run dev
```

Sans clés API, l'application tourne en **mode simulation** : images et clips factices générés localement,
pour tester tout le parcours gratuitement.

Pour devenir admin (ajout de crédits sur `/admin`) : mettre son email dans `ADMIN_EMAILS`.

## Pipeline d'une vidéo

1. Planches des personnages (si pas déjà en cache)
2. Plan de la saison (une fois par série)
3. Scénario de l'épisode découpé en plans de `CLIP_SECONDS` secondes
4. Image de chaque plan (OpenAI, avec les planches en référence)
5. Animation de chaque plan (Grok)
6. Montage final + sous-titres

Chaque étape est sauvegardée : si le serveur redémarre, la vidéo reprend là où elle s'était arrêtée.

## Structure

```
src/lib/config.ts            formats, crédits, modèles
src/lib/catalog/             pays, personnages, histoires prêtes
src/lib/ai/                  OpenAI, Grok (xAI), scénario, simulation
src/lib/pipeline/            file d'attente, pipeline, ffmpeg
src/lib/service.ts           création de série / épisode suivant / relance
src/app/                     pages (Next.js App Router) et actions serveur
```

## Limites connues du MVP

- Base SQLite locale + file d'attente en mémoire : **un seul serveur**. Pour la prod : Postgres + stockage objet (S3/R2) + worker séparé.
- Pas de paiement (Stripe) ni d'affiliation pour l'instant — crédits ajoutés via `/admin`.
- Les appels OpenAI / Grok n'ont pas encore été testés avec de vraies clés (format de l'API Grok à valider).
- Si Grok refuse les images en base64, définir `PUBLIC_BASE_URL` (URL publique du site) pour qu'il télécharge l'image par URL.
