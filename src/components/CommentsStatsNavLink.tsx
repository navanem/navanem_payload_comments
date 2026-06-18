import React from 'react'

/**
 * Nav link to the comment Statistics view. Registered via `afterNavLinks` so the
 * plugin works out-of-the-box with Payload's default Nav. (Hosts that ship a
 * custom Nav can ignore this and place the link themselves.) Uses Payload's
 * native `nav__link` classes so it inherits the admin theme.
 */
export function CommentsStatsNavLink() {
  return (
    <a className="nav__link" href="/admin/comments-statistics">
      <span className="nav__link-label">Comment Statistics</span>
    </a>
  )
}
