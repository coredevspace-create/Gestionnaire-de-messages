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

## Déploiement sur Vercel

1. **Settings → Build and Deployment → Framework Preset : Next.js**
2. **Storage → Create → Neon (Postgres)** et le connecter au projet → `DATABASE_URL` est ajouté tout seul.
3. **Storage → Create → Blob** et le connecter au projet → `BLOB_READ_WRITE_TOKEN` est ajouté tout seul.
4. **Settings → Environment Variables** : `OPENAI_API_KEY`, `XAI_API_KEY`, `ADMIN_EMAILS` (ton email).
5. Redéployer. Les tables sont créées automatiquement au premier lancement.

Sans clés IA, le site fonctionne en **mode simulation** (vidéos factices, gratuit).

### Comment la génération tient dans les limites de Vercel

Une fonction Vercel ne peut pas tourner plus de 300 s, alors qu'une vidéo de 70 s prend plusieurs minutes.
La génération est donc découpée en petites étapes sauvegardées en base :

- chaque appel à `/api/videos/[id]/tick` avance la vidéo pendant ~2 min puis **se relance lui-même** ;
- un « bail » en base garantit qu'une seule fonction travaille sur une vidéo à la fois ;
- les clips Grok sont **envoyés tous en même temps** puis récupérés quand ils sont prêts ;
- la page de la vidéo relance aussi la génération si elle s'est arrêtée (filet de sécurité).

ffmpeg est fourni par `ffmpeg-static` et la police des sous-titres est dans `fonts/`.

Si la « Deployment Protection » de Vercel est active sur les previews, activer
« Protection Bypass for Automation » pour que les auto-relances passent.

## Développement local

Prérequis : Node.js ≥ 22.13.

```bash
npm install
cp .env.example .env.local
npm run dev
```

En local, sans `DATABASE_URL` ni `BLOB_READ_WRITE_TOKEN`, tout est stocké dans `./data` (Postgres embarqué PGlite + fichiers).

Pour devenir admin (ajout de crédits sur `/admin`) : mettre son email dans `ADMIN_EMAILS`.

## Pipeline d'une vidéo

1. Planches des personnages (si pas déjà en cache)
2. Plan de la saison (une fois par série)
3. Scénario de l'épisode découpé en plans de `CLIP_SECONDS` secondes
4. Image de chaque plan (OpenAI, avec les planches en référence)
5. Animation de chaque plan (Grok, en parallèle)
6. Montage final + sous-titres (ffmpeg)

## Structure

```
src/lib/config.ts            formats, crédits, modèles
src/lib/db.ts                Postgres (Neon) / PGlite en local
src/lib/storage.ts           Vercel Blob / fichiers locaux
src/lib/catalog/             pays, personnages, histoires prêtes
src/lib/ai/                  OpenAI, Grok (xAI), scénario, simulation
src/lib/pipeline/            étapes de génération, enchaînement, ffmpeg
src/lib/service.ts           création de série / épisode suivant / relance
src/app/                     pages (Next.js App Router) et actions serveur
```

## Limites connues du MVP

- Pas de paiement (Stripe) ni d'affiliation pour l'instant — crédits ajoutés via `/admin`.
- Les appels OpenAI / Grok n'ont pas encore été testés avec de vraies clés (format de l'API Grok à valider).
- Les vidéos stockées sur Vercel Blob ont une URL publique (difficile à deviner, mais pas protégée).
