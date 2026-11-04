# Model card: NeuroClass exam proctoring signals

## Components

| Component | Where it runs | Model | Trained by us? |
|---|---|---|---|
| Face presence, face count, face box, head pose (yaw/pitch/roll), iris gaze | Student browser | Google MediaPipe **Face Landmarker** (`face_landmarker.task`, float16, v1) | No: pre-trained and validated by Google |
| Phone/device check (optional) | Student browser | TensorFlow.js **COCO-SSD** (`lite_mobilenet_v2`), class `cell phone` only, score ≥ 0.5, two consecutive hits about 4 s apart | No |
| Camera obstruction | Student browser | Brightness × contrast of a 32×24 thumbnail (quality < 0.12 for 3 s) | Rule |
| Temporal risk and per-attempt anomaly | `ml-service` (Render) | `robust-baseline-v1.1.0`: median/MAD baseline from the calibration window plus deterministic temporal rules | No training: unsupervised per attempt |
| Identity | Existing face service (Render) | ArcFace embeddings (existing attendance service) | Existing |

No new models were trained. There is no labelled, consented dataset of real exam sessions in either repository, so training a "cheating classifier" would only produce unsupported accuracy claims.

## Signals and default thresholds (teacher-configurable per test)

| Signal | Fires when | Default |
|---|---|---|
| `face_absent` | 0 faces and the frame is not dark | 5 s |
| `multiple_faces` | > 1 face | 2 s |
| `head_turned` | \|yaw\| ≥ 35° or \|pitch\| ≥ 25° with exactly one face | 4 s |
| `looking_away` | \|horizontal gaze\| ≥ 0.65 with exactly one face | 5 s |
| `camera_obstructed` | frame quality < 0.12 | 3 s |
| `suspicious_object` | `cell phone` detected twice in a row | about 8 s |
| ml-service `head_away` / `gaze_deviation` / `behavior_anomaly` | same rules server-side, plus robust distance from the student's own baseline ≥ 60 | 4 s |

Each signal has a cooldown (default 20 s), so one continuous condition produces one warning. Pose and gaze are ignored when 0 or more than 1 face is visible; those cases have their own signals.

## Intended use

A **review aid** for teachers. A warning means "a teacher may want to look at this moment". It is never a misconduct decision. The app never fails, blocks or penalises a student automatically on a model output. Teachers can dismiss events, and students can appeal.

## Evaluation status

- Unit tests check rule behaviour: persistence, cooldowns, pose and gaze precedence, and that brief glances are ignored.
- `scripts/evaluate.py` checks relative behaviour on synthetic sequences (normal produces no events; multi-face and absence produce the expected events).
- **Not yet measured:** precision, recall, false-positive and false-negative rates on real sessions across skin tones, glasses, lighting, camera quality and disability-related movement. For face verification, the false acceptance and false rejection rates of the existing ArcFace service have not been measured in this repository.

### Recommended evaluation before high-stakes use

1. Collect a **consented**, licensed dataset of short sessions (target ≥ 50 participants, diverse demographics and lighting) with scripted behaviours (look at phone, second person, leave the seat) and natural behaviour.
2. Label events per second. Split train/validation/test **by participant** (no leakage).
3. Report per-signal precision, recall and FPR overall **and by subgroup**. Tune thresholds for a low false-positive rate. Document the chosen operating point here.
4. For identity: report FAR and FRR at `EXAM_FACE_MATCH_THRESHOLD` (default 45) on a held-out set, plus liveness and spoof tests.

## Privacy

No video is stored or uploaded. ml-service rejects any payload over 64 KB and any unknown field (e.g. `image`). Identity frames go server-to-server to the face service and are not stored by the API. Embeddings never reach the browser.

## Versioning

`ML_MODEL_VERSION` is recorded on every ml-service event (`details.model`). Bump it whenever thresholds or rules change.
