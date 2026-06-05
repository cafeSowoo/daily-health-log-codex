# Product Design UX/UI Audit

Date: 2026-06-05
Target: Daily Health Log local app at http://localhost:4174/#
Destination: local folder

## Evidence

1. `01-home-desktop.png` - Home, current day summary
2. `02-record-sheet-desktop.png` - Record entry bottom sheet
3. `03-calendar-desktop.png` - Calendar with selected date panel
4. `04-stats-desktop.png` - Weekly stats
5. `05-home-mobile.png` - Mobile home viewport
6. `06-record-sheet-mobile.png` - Mobile record entry sheet
7. `07-calendar-mobile.png` - Mobile calendar and selected date panel
8. `08-ai-feedback-mobile.png` - AI feedback empty state

## Flow Steps

1. Home dashboard
   - Health: good, with density risk.
   - What works: the day summary is immediately useful. The repeated record cards make the primary task clear: add or edit health records for today.
   - UX issue: the score control shows only `-`, while the accessible label says "점수 미산정, 입력 2개". Sighted users see less context than screen reader users. This makes the score look like a disabled or placeholder button rather than a useful status.
   - UX issue: `입력 전` plus a separate `+` is clear after learning, but on first use each empty card has two competing signals: status text and add action. A stronger empty affordance could say "운동 추가" or use one primary action area.
   - Information structure: the order is logical for daily capture, but seven categories plus memo/AI creates a lot of first-screen scanning. The completed and incomplete states are visually similar, so the user's eye must read every card.
   - Accessibility risk: icon-only top buttons have aria labels, but their visible meaning is weak. Login currently uses a logout-like icon in the screenshot, which can confuse users even if the label is correct.

2. Record entry sheet
   - Health: good, but validation/status needs more guidance.
   - What works: the sheet preserves context by dimming the home screen. The title and type badge make it clear which record is being edited.
   - UX issue: the save button is active before required fields are selected. If the form rejects blank values, the user needs inline feedback near the failed field. If blank save is allowed, the sheet should explain what blank means.
   - UX issue: "운동시간" input placeholder is only "분", which is compact but easy to miss. A label or suffix treatment inside the field would reduce hesitation.
   - Button placement: Cancel and Save are placed naturally at the bottom, but on small screens the primary save button is close to the bottom edge and could compete with system gestures.
   - Accessibility risk: choice chips are implemented as checkboxes/radio-like inputs. The visual selected/unselected states should be tested with keyboard and screen reader focus, not just pointer interaction.

3. Calendar and selected date panel
   - Health: mixed.
   - What works: the calendar gives a useful month overview, and selecting a day keeps the same category-card language as Home. This consistency is strong.
   - UX issue: on mobile, selecting a date creates a large panel that nearly replaces the calendar, but the screen still visually shows both. The back arrow means "return to calendar", while the bottom nav still says Calendar. This can feel like a sub-mode without a clear title.
   - UX issue: the calendar grid is partly hidden behind the selected-date panel in the captured mobile state. The selected date panel is useful, but users may not realize the grid can still be swiped or returned to.
   - UX issue: month title uses `Jun. 2026` while date labels use Korean. Mixed locale is small, but it weakens polish.
   - Mobile gesture check: implementation includes `touch-action`, `touchcancel`, `pointercancel`, and `setPointerCapture` for calendar/month and selected panel gestures. This is a good foundation. The risk is discoverability rather than missing listeners.

4. Stats
   - Health: good for quick reading, weak for control clarity.
   - What works: weekly totals are simple and useful. The chart is not overloaded.
   - UX issue: the metric selector row is icon-only. The selected metric is described in the subtitle, but users must infer which icons map to which metric unless they already know the category icon system.
   - UX issue: chart values and legend are visible, but there is no empty or low-data explanation on the captured week. If a week has no records, the empty chart should tell the user what to add next.
   - Accessibility risk: the chart has an image-style accessible label, but icon-only metric controls need accessible names that include the metric, not only the material icon name.

5. AI feedback empty state
   - Health: fair.
   - What works: "아직 AI 피드백이 없습니다" is direct, and the CTA is visible.
   - UX issue: the empty state does not explain prerequisites. If feedback generation needs login, enough records, model secrets, or network access, the user will only learn after pressing the button.
   - UX issue: the model picker appears before the main action. For a casual daily-log user, model choice is advanced configuration and may distract from "피드백 받기".
   - Error-state limit: I did not trigger AI feedback generation because it may call an external function or require auth/secrets. Error handling should be verified separately with mocked responses.

6. Mobile navigation and gestures
   - Health: good structure, with discoverability risks.
   - What works: bottom navigation is conventional and the three main destinations are clear.
   - Observed issue: in the automation run, the bottom Calendar tab did not reliably switch views, while the Home date button did. The saved screenshots show Calendar reached through the date button. This may be an automation targeting quirk, but it is worth manually checking on the actual device/PWA.
   - Gesture implementation check: Home, selected-date panel, sheet, stats chart, and calendar month all have explicit touch/pointer handling in code. The project also uses `touch-action: pan-y`, `touch-action: manipulation`, `pointercancel`, `touchcancel`, and pointer capture in relevant places.
   - UX issue: gestures are implemented but not visible. Users may not discover that swiping cards, selected-date panel, calendar months, or charts changes state unless they accidentally try it.

## Highest Priority Recommendations

1. Make status text more explanatory where the UI currently uses compact symbols.
   - Replace or supplement the score `-` with a visible label such as "미산정" or "2개 입력".
   - Empty cards can use action-first language, for example "운동 추가", while completed cards keep summary-first language.

2. Clarify sub-modes.
   - Calendar selected-date mode should feel like a deliberate sub-screen. Consider a clearer header such as "선택한 날짜 기록" and a more obvious "달력 보기" return action.

3. Move advanced AI options behind a secondary control.
   - Keep "AI 피드백 받기" primary.
   - Put model selection under "모델 설정" or in Profile unless model switching is a frequent user task.

4. Strengthen mobile gesture discoverability.
   - Add subtle visual handles or microcopy-free affordances where gestures matter: sheet grab handle, selected-date panel handle, chart/week swipe controls.
   - Keep existing `touch-action`, `pointercancel`, `touchcancel`, and pointer capture logic. The implementation has the right ingredients.

5. Improve icon-only control naming and visible labels.
   - Stats metric buttons should expose names like "운동 추이", "식사 추이", and ideally show a selected label below or beside the icon.
   - Top login/profile icon visuals should match the actual auth state.

## Accessibility Risks From Screenshots

- Color contrast appears mostly acceptable, but muted beige labels such as `입력 전`, `미입력`, and chart axis labels should be checked numerically.
- Keyboard focus is visible in screenshots as a gold outline, which is good. Focus order and keyboard operation were not fully audited.
- Screen reader labels exist for many buttons, but several visible icon controls still risk being announced as icon names if aria labels are missing or not specific.
- Chart accessibility needs more than an `aria-label`; the data should be available in text or table form for non-visual users.

## Limits

- This audit is based on the current local browser state and saved screenshots from this run.
- I did not clear localStorage or create a brand-new empty account state, to avoid altering user data.
- I did not submit forms, delete records, sign in, or generate AI feedback.
- I did not claim full accessibility compliance; screenshot and DOM checks are not enough for that.
