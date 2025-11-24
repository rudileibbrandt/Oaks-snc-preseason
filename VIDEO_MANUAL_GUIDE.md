# Creating a Video Training Manual with AI

This guide covers different ways to use AI to create video tutorials for your training manual.

---

## Option 1: AI Video Generation from Script (Easiest)

### Tools:
- **Synthesia** (https://www.synthesia.io) - AI avatars + voice
- **D-ID** (https://www.d-id.com) - Talking avatars
- **HeyGen** (https://www.heygen.com) - AI video generation
- **Runway ML** (https://runwayml.com) - Text-to-video

### Process:
1. **Write a script** for each section of the manual
2. **Choose an AI avatar** (or use your own photo)
3. **Generate the video** - AI reads the script and creates the video
4. **Add screen recordings** - Overlay actual app screenshots/videos

### Example Script Structure:
```
[Scene 1: Introduction]
"Welcome to The Oaks Performance Portal. In this video, we'll show you how to log your first workout."

[Scene 2: Login]
"First, open the app and click 'Continue with Google' or 'Continue with Microsoft'..."

[Scene 3: Screen Recording]
[Show actual app login screen]
```

### Pros:
- ✅ Fast - Generate videos in minutes
- ✅ Professional looking
- ✅ Multiple languages available
- ✅ No need to be on camera

### Cons:
- ❌ Can look robotic
- ❌ May need editing
- ❌ Cost (usually subscription-based)

---

## Option 2: Screen Recording + AI Narration (Best Quality)

### Tools:
- **Loom** (https://www.loom.com) - Screen recording with AI transcription
- **OBS Studio** (free) + **ElevenLabs** (AI voice) - Professional setup
- **ScreenFlow** (Mac) + **Murf AI** (voiceover)
- **Camtasia** + **Descript** (AI voice cloning)

### Process:
1. **Record your screen** navigating through the app
2. **Use AI to generate narration** from your script
3. **Sync the audio** with your screen recording
4. **Edit and polish** the video

### Step-by-Step:

**Step 1: Record Screen**
```bash
# On Mac: Use QuickTime or ScreenFlow
# On Windows: Use OBS Studio or Camtasia
# Record yourself clicking through the app
```

**Step 2: Write Narration Script**
```
"Welcome to The Oaks Performance Portal. 
First, let's sign in. Click 'Continue with Google'..."
```

**Step 3: Generate AI Voice**
- Use **ElevenLabs** (https://elevenlabs.io) - Best quality AI voices
- Use **Murf AI** (https://murf.ai) - Good for tutorials
- Use **Descript** (https://www.descript.com) - Can clone your voice

**Step 4: Combine**
- Import screen recording into video editor
- Add AI-generated narration
- Sync audio with screen actions
- Add captions/subtitles

### Pros:
- ✅ Shows real app (most authentic)
- ✅ High quality
- ✅ Easy to update (re-record specific sections)
- ✅ Can use your own voice (with voice cloning)

### Cons:
- ❌ Takes more time
- ❌ Requires video editing skills
- ❌ Need to record actual app usage

---

## Option 3: AI-Powered Video Editing

### Tools:
- **Descript** (https://www.descript.com) - AI video editing
- **Runway ML** (https://runwayml.com) - AI video tools
- **Pictory** (https://pictory.ai) - Script to video
- **InVideo AI** (https://invideo.io) - AI video creation

### Process:
1. **Provide screenshots** of each screen
2. **Write a script** describing what happens
3. **AI creates video** with transitions, animations, voiceover
4. **Review and edit** as needed

### Example Input:
```
Screenshot: login-screen.png
Script: "The login screen shows three options: Google, Microsoft, and Email/Password. Click on your preferred method..."
```

### Pros:
- ✅ Automated editing
- ✅ Professional transitions
- ✅ Can use screenshots (no need to record)
- ✅ Fast turnaround

### Cons:
- ❌ Less authentic (not showing real app)
- ❌ May need manual adjustments
- ❌ Subscription costs

---

## Option 4: Interactive AI Video (Advanced)

### Tools:
- **Storyline 360** + AI narration
- **Vyond** (animated videos)
- **Powtoon** (animated explainer videos)

### Process:
1. Create animated/storyboard version of your app
2. Add AI-generated voiceover
3. Add interactive elements (clickable hotspots)
4. Export as video or interactive experience

### Pros:
- ✅ Very engaging
- ✅ Can be interactive
- ✅ Professional animations

### Cons:
- ❌ Time-consuming
- ❌ Expensive
- ❌ May not match actual app exactly

---

## Recommended Approach: Hybrid Method

**Best of both worlds:**

1. **Record actual app usage** (screen recording)
2. **Use AI for narration** (ElevenLabs or Murf AI)
3. **Use AI for editing** (Descript or Runway)
4. **Add captions automatically** (YouTube auto-captions or Descript)

### Tools Needed:
- **Screen Recording**: Loom, OBS Studio, or QuickTime
- **AI Voice**: ElevenLabs or Murf AI
- **Video Editing**: Descript or Adobe Premiere
- **Hosting**: YouTube (free) or Vimeo

---

## Step-by-Step: Creating Your Video Manual

### Phase 1: Preparation

1. **Create a script** for each section:
   - Login & Setup (2-3 minutes)
   - Logging a Workout (3-4 minutes)
   - Viewing Stat Board (2-3 minutes)
   - For Coaches (2-3 minutes)

2. **Take screenshots** of every screen (use SCREENSHOT_GUIDE.md)

3. **Record screen demos** of key actions:
   - Signing in
   - Logging a workout
   - Navigating the Stat Board

### Phase 2: AI Voice Generation

**Using ElevenLabs (Recommended):**

1. Sign up at https://elevenlabs.io
2. Choose a voice (or clone your own)
3. Paste your script
4. Generate audio
5. Download MP3 files

**Script Example:**
```
Welcome to The Oaks Performance Portal. 
This video will show you how to log your first workout.

First, let's sign in. You'll see three options on the login screen:
Continue with Google, Continue with Microsoft, or Email and Password.
Click on your preferred method...
```

### Phase 3: Video Creation

**Option A: Simple (Loom + AI Voice)**
1. Record screen with Loom (it auto-transcribes)
2. Replace audio with AI-generated voice
3. Export video

**Option B: Professional (OBS + Descript)**
1. Record screen with OBS Studio
2. Import to Descript
3. Add AI voiceover
4. Edit with Descript's AI tools
5. Export final video

### Phase 4: Post-Production

1. **Add captions** (Descript or YouTube auto-captions)
2. **Add chapter markers** (for easy navigation)
3. **Add callouts/arrows** (highlight important buttons)
4. **Add transitions** between sections
5. **Export** in multiple formats (1080p, 720p)

---

## Quick Start: Using Loom + ElevenLabs

### Step 1: Record with Loom
1. Install Loom (https://www.loom.com)
2. Click "New Video" → "Screen + Camera" (or just screen)
3. Record yourself navigating through the app
4. Stop recording
5. Loom auto-generates a transcript

### Step 2: Generate AI Voice
1. Copy the transcript from Loom
2. Go to ElevenLabs (https://elevenlabs.io)
3. Paste script
4. Choose voice (try "Rachel" or "Adam" for professional sound)
5. Generate and download audio

### Step 3: Replace Audio
1. Download your Loom video
2. Import to a video editor (iMovie, Premiere, or Descript)
3. Mute original audio
4. Add AI-generated voiceover
5. Sync with screen actions
6. Export

### Step 4: Upload
1. Upload to YouTube (unlisted or public)
2. YouTube auto-generates captions
3. Add chapter markers in description:
   ```
   0:00 Introduction
   0:30 Signing In
   2:15 Logging Workouts
   5:00 Stat Board
   ```

---

## AI Tools Comparison

### Voice Generation:
| Tool | Quality | Cost | Best For |
|------|---------|------|----------|
| **ElevenLabs** | ⭐⭐⭐⭐⭐ | $5-22/mo | Professional narration |
| **Murf AI** | ⭐⭐⭐⭐ | $19-99/mo | Tutorials, presentations |
| **Descript** | ⭐⭐⭐⭐ | $12-24/mo | Voice cloning, editing |
| **Google TTS** | ⭐⭐⭐ | Free | Basic narration |

### Video Generation:
| Tool | Quality | Cost | Best For |
|------|---------|------|----------|
| **Synthesia** | ⭐⭐⭐⭐ | $29-89/mo | AI avatars, presentations |
| **Runway ML** | ⭐⭐⭐⭐⭐ | $12-95/mo | Creative videos, effects |
| **Pictory** | ⭐⭐⭐ | $19-99/mo | Script to video |
| **InVideo AI** | ⭐⭐⭐ | $15-60/mo | Marketing videos |

### Video Editing:
| Tool | Quality | Cost | Best For |
|------|---------|------|----------|
| **Descript** | ⭐⭐⭐⭐⭐ | $12-24/mo | AI editing, transcription |
| **Runway ML** | ⭐⭐⭐⭐ | $12-95/mo | AI effects, editing |
| **Adobe Premiere** | ⭐⭐⭐⭐⭐ | $22.99/mo | Professional editing |
| **iMovie** | ⭐⭐⭐ | Free (Mac) | Simple editing |

---

## Recommended Workflow

### For Quick Results (1-2 hours):
1. **Record** screen with Loom (15 min)
2. **Generate** AI voice with ElevenLabs (10 min)
3. **Edit** in Descript (30 min)
4. **Upload** to YouTube (10 min)

### For Professional Quality (4-6 hours):
1. **Plan** script and storyboard (1 hour)
2. **Record** multiple takes with OBS (1 hour)
3. **Generate** AI voice with ElevenLabs (30 min)
4. **Edit** in Adobe Premiere or Descript (2 hours)
5. **Add** captions, chapters, callouts (1 hour)
6. **Review** and polish (30 min)

---

## Script Templates

### Template 1: Screen Introduction
```
[Screen: Login Screen]
"Welcome to The Oaks Performance Portal. 
On this screen, you'll see three ways to sign in.
Let's start with the easiest option - Google..."
```

### Template 2: Action Explanation
```
[Action: Clicking button]
"When you click 'Continue with Google', a popup will appear.
Sign in with your Google account, and you'll be automatically logged in..."
```

### Template 3: Data Entry
```
[Screen: Workout Input]
"Now, let's enter your workout data. 
For the Hex Bar Deadlift, you'll see three fields:
Weight in pounds, number of sets, and number of reps.
Simply type your numbers directly into each field..."
```

---

## Tips for Great AI Videos

1. **Write natural scripts** - AI voices sound better with conversational language
2. **Use pauses** - Add "..." or "[pause]" in scripts for natural pacing
3. **Keep it short** - 3-5 minute videos work best
4. **Show, don't tell** - Let the screen recording do the talking
5. **Add captions** - Makes videos accessible and easier to follow
6. **Use chapters** - Break long videos into sections
7. **Test voices** - Try different AI voices to find the best fit

---

## Cost Estimate

### Free Option:
- Screen recording: Loom (free tier) or OBS (free)
- AI voice: Google TTS (free) or ElevenLabs (free tier)
- Editing: iMovie (free) or DaVinci Resolve (free)
- Hosting: YouTube (free)
- **Total: $0/month**

### Professional Option:
- Screen recording: Loom Pro ($12.50/mo)
- AI voice: ElevenLabs Creator ($5/mo)
- Editing: Descript ($12/mo)
- Hosting: YouTube (free) or Vimeo ($7/mo)
- **Total: ~$30/month**

---

## Next Steps

1. **Choose your approach** (I recommend Loom + ElevenLabs)
2. **Write scripts** for each section
3. **Record screen demos** of the app
4. **Generate AI voiceovers**
5. **Edit and combine**
6. **Upload to YouTube** with chapters
7. **Link from training manual**

---

## Example: Complete Video Structure

**Video 1: Getting Started (3 min)**
- 0:00 - Introduction
- 0:30 - Signing In
- 1:30 - Completing Profile
- 2:30 - Main Menu Overview

**Video 2: Logging Workouts (4 min)**
- 0:00 - Accessing Workouts
- 0:30 - Week Navigation
- 1:00 - Opening a Workout Day
- 1:30 - Entering Data
- 3:00 - Completing Workout

**Video 3: Stat Board (3 min)**
- 0:00 - Accessing Stat Board
- 0:30 - Workouts Completed View
- 1:30 - Best View
- 2:30 - Understanding Rankings

**Video 4: For Coaches (2 min)**
- 0:00 - Analytics View
- 1:00 - Performers View

---

Would you like me to:
1. Create detailed scripts for each video?
2. Set up a specific tool workflow?
3. Generate AI voice samples?
4. Create a video editing checklist?

Let me know which approach you'd like to pursue!

