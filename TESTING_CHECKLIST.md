# Design System Testing - Quick Checklist

**Test Date**: ________________
**Tester**: ________________
**Device**: ASUS Laptop - Windows 10
**Commit Hash**: ________________

---

## Pre-Testing Setup

- [ ] Backed up current code: `git checkout -b backup-test-[date]`
- [ ] Application builds successfully: `yarn build`
- [ ] Dev server starts: `yarn dev`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Database backed up

---

## 🔴 CRITICAL TESTS (Must Pass)

### Authentication

- [ ] Can login with valid credentials (admin/admin)
- [ ] Invalid login shows error in red
- [ ] Can register new user
- [ ] Password strength indicator works (red → green)
- [ ] Form validation shows errors

### Core Functionality

- [ ] Dashboard loads without errors
- [ ] Menu page displays items
- [ ] Can add new menu item (dialog opens fully)
- [ ] Stock page displays inventory
- [ ] Can add new stock item (dialog opens fully)

### Critical Visual Issues

- [ ] **NO NESTED SCROLLING** on dashboard (smooth scroll)
- [ ] **NO NESTED SCROLLING** on menu page (smooth scroll)
- [ ] **NO NESTED SCROLLING** on stock page (smooth scroll)
- [ ] Dialogs don't get clipped at bottom (use dvh)
- [ ] All dialogs are fully visible when opened

### Performance (ASUS Laptop)

- [ ] Login page loads < 2 seconds
- [ ] Dashboard loads < 5 seconds
- [ ] Scrolling is smooth (no janking)
- [ ] Application doesn't freeze
- [ ] Memory usage reasonable (< 400MB after 5 pages)

### Printer Tests

- [ ] Printers detected within 8 seconds
- [ ] Invoice prints without blank pages

**Critical Status**: [ ] ✅ PASS  [ ] ❌ FAIL

---

## 🟡 HIGH PRIORITY TESTS (Should Pass)

### Visual Consistency

#### Login Page
- [ ] Form width is 600px (max-w-form)
- [ ] Spacing feels consistent
- [ ] Error messages use semantic red (`text-destructive`)
- [ ] Button and input same height (40px)

#### Register Page
- [ ] Matches login page style
- [ ] Password bar is 12px height (visible)
- [ ] All errors use semantic red

#### Dashboard
- [ ] Page title is text-2xl
- [ ] Cards have consistent padding (p-6)
- [ ] Grid spacing is even
- [ ] Stats display correctly

#### Menu Page
- [ ] "Add Menu Item" button positioned correctly
- [ ] Dialog title is readable
- [ ] Form fields properly spaced
- [ ] Categories display in grid

#### Stock Page
- [ ] Stats cards aligned
- [ ] Table is readable
- [ ] Filters work correctly

### Component Checks

- [ ] All buttons: Small=32px, Default=40px, Large=48px
- [ ] All inputs: 40px height (matches buttons)
- [ ] All card padding: 24px (p-6)
- [ ] All dialogs use max-h-[90dvh] (not vh)

### Responsive Design

- [ ] Desktop (1920x1080): All pages look good
- [ ] Tablet (768x1024): Layout adjusts correctly
- [ ] Mobile (375x667): Forms are usable

**High Priority Status**: [ ] ✅ PASS  [ ] ❌ FAIL

---

## 🟢 NICE TO HAVE TESTS (Optional)

### Spacing Alignment

- [ ] All spacing uses 8pt multiples
- [ ] No arbitrary values (gap-[18px])
- [ ] Consistent vertical rhythm

### Typography

- [ ] Headings use proper hierarchy
- [ ] Body text is text-base (readable)
- [ ] Labels are text-sm

### Accessibility

- [ ] Tab navigation works
- [ ] Touch targets ≥ 40px on mobile
- [ ] Color contrast is good
- [ ] Keyboard-only navigation possible

**Nice to Have Status**: [ ] ✅ PASS  [ ] ❌ FAIL

---

## Performance Metrics (Record Actual)

### Page Load Times (ASUS Laptop)

- Login: _________ seconds (target: < 2s)
- Dashboard: _________ seconds (target: < 5s)
- Menu: _________ seconds (target: < 4s)
- Stock: _________ seconds (target: < 4s)

### Memory Usage

- Initial: _________ MB (target: < 200MB)
- After 5 pages: _________ MB (target: < 400MB)

### Scrolling

- [ ] Smooth  [ ] Some lag  [ ] Significant lag

### Printer

- Detection time: _________ seconds (target: < 8s)
- Invoice printing: [ ] Works  [ ] Blank  [ ] Other

---

## Issues Found

### Critical Issues (Block Deployment)

```
1. _______________________________________________

2. _______________________________________________

3. _______________________________________________
```

### High Priority Issues (Should Fix)

```
1. _______________________________________________

2. _______________________________________________

3. _______________________________________________
```

### Minor Issues (Can Fix Later)

```
1. _______________________________________________

2. _______________________________________________

3. _______________________________________________
```

---

## Test Results Summary

| Category | Status |
|----------|--------|
| 🔴 Critical Tests | [ ] PASS [ ] FAIL |
| 🟡 High Priority | [ ] PASS [ ] FAIL |
| 🟢 Nice to Have | [ ] PASS [ ] FAIL |

### Overall Recommendation

- [ ] ✅ **DEPLOY** - All critical tests passed, ready for production
- [ ] ⚠️ **DEPLOY WITH NOTES** - Minor issues found, document for later
- [ ] ❌ **DO NOT DEPLOY** - Critical issues found, must fix first

---

## Screenshots Taken

- [ ] Login page (desktop, mobile)
- [ ] Register page (desktop, mobile)
- [ ] Dashboard (desktop)
- [ ] Menu page with dialog open
- [ ] Stock page with dialog open
- [ ] Any bugs found

---

## Rollback Info (If Needed)

**Previous Working Commit**: _______________

**Rollback Command**:
```bash
git checkout [commit-hash]
yarn install
yarn build
```

---

## Notes & Comments

```
Additional observations, edge cases found, or recommendations:







```

---

## Sign-Off

**Tested By**: _______________
**Date**: _______________
**Time Spent**: _________ hours
**Next Steps**: _______________

---

## Quick Reference - What Changed

### ✅ What Was Fixed

1. **Nested Scrolling** - Dashboard, Menu, Stock now single scroll
2. **Viewport Heights** - All dialogs use dvh instead of vh
3. **Button Sizes** - Default button h-9 → h-10 (8pt aligned)
4. **Hard-Coded Colors** - Replaced with semantic tokens
5. **Spacing** - Now follows 8-point grid system
6. **Form Widths** - Login/Register now 600px (was 448px)

### 🔍 What to Look For

1. **Smooth Scrolling** - No "scroll within scroll" feeling
2. **Full Dialogs** - Nothing cut off at bottom
3. **Consistent Spacing** - Things feel aligned and balanced
4. **Readable Text** - Nothing too small or cramped
5. **Semantic Colors** - Errors are red, success is green

### ⚠️ Potential Issues

1. **Button height change** - Layouts might shift slightly
2. **Form width change** - Login/Register look different
3. **Spacing changes** - Some pages might feel more spacious

---

**End of Quick Checklist**

For detailed testing instructions, see [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
