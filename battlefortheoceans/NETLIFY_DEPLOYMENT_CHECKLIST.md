# Netlify Deployment Checklist

## Quick Answer

**Do you need to explicitly link to bunny.net CDN files?**
- **No** - The code automatically uses CDN if `REACT_APP_GAME_CDN` environment variable is set
- If CDN is not set, it automatically falls back to public folder assets

**Do you need to move public assets?**
- **No** - Public assets stay in the `public/` folder
- They serve as fallback if CDN is unavailable
- Netlify automatically copies them to `build/` during build

## What's Already Done ✅

1. ✅ `netlify.toml` created with build configuration
2. ✅ `ConfigLoader` updated with CDN support and fallback
3. ✅ `HitOverlayRenderer` updated with CDN fallback for ship SVGs
4. ✅ `SoundManager` already supports CDN via `REACT_APP_GAME_CDN`
5. ✅ Other components (PromotionalBox, PurchasePage, App.js) already use CDN

## What You Need to Do

### 1. Upload Assets to bunny.net CDN

Upload all files from `public/` folder to your bunny.net CDN, maintaining the exact same folder structure:

```
public/assets/ → cdn.battlefortheoceans.com/assets/
public/sounds/ → cdn.battlefortheoceans.com/sounds/
public/captains/ → cdn.battlefortheoceans.com/captains/
public/config/ → cdn.battlefortheoceans.com/config/
```

### 2. Set Environment Variable in Netlify

1. Go to Netlify Dashboard
2. Select your site
3. Site settings → Environment variables
4. Add: `REACT_APP_GAME_CDN` = `https://cdn.battlefortheoceans.com`
5. Set for "Production" environment

### 3. Deploy

- **Automatic**: Push to your main branch (Netlify auto-deploys)
- **Manual**: Use `netlify deploy --prod`

## How It Works

### Asset Loading Priority

1. **If `REACT_APP_GAME_CDN` is set**:
   - Tries CDN first: `https://cdn.battlefortheoceans.com/assets/...`
   - Falls back to local: `/assets/...` (for ship SVGs only)

2. **If `REACT_APP_GAME_CDN` is NOT set**:
   - Uses local public folder: `/assets/...`
   - All assets served from Netlify

### Fallback Behavior

- **Ship SVGs**: ✅ Automatic fallback (CDN → local)
- **Sounds**: ⚠️ No automatic fallback (uses CDN or local based on env var)
- **Images/Videos**: ⚠️ No automatic fallback (uses CDN or local based on env var)

**Recommendation**: Ensure all assets are on CDN for production. The fallback is mainly for development.

## Testing

### Test with CDN
1. Set `REACT_APP_GAME_CDN` in Netlify
2. Deploy
3. Check browser DevTools → Network tab
4. Verify assets load from `cdn.battlefortheoceans.com`

### Test without CDN (Fallback)
1. Remove `REACT_APP_GAME_CDN` from Netlify
2. Redeploy
3. Verify assets load from Netlify domain

## Files Modified

- ✅ `netlify.toml` - Netlify build configuration
- ✅ `src/utils/ConfigLoader.js` - CDN support with fallback
- ✅ `src/renderers/HitOverlayRenderer.js` - Ship SVG fallback
- ✅ `DEPLOYMENT.md` - Full deployment guide

## Summary

**You don't need to explicitly link to CDN** - it's automatic via environment variable.

**You don't need to move public assets** - they stay in place and serve as fallback.

**Just set the environment variable and deploy!**

