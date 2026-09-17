import { css } from '../lib/css';
import { WORDMARK_CROP_D, WORDMARK_FULL_D } from '../assets/wordmark';

/** The full "THE CHROMIES" lockup. Top-left of the app bar and the share card only. */
export function Wordmark({ onClick, title }: { onClick?: () => void; title?: string }) {
  return (
    <span
      onClick={onClick}
      title={title}
      style={css(
        `display:flex;height:30px;color:#FFFFFF${onClick ? ';cursor:pointer' : ''}`,
      )}
    >
      <svg
        style={css('height:100%;width:auto;display:block')}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1960 500"
        role="img"
        aria-label="The Chromies"
      >
        <path fill="currentColor" fillRule="evenodd" d={WORDMARK_FULL_D} />
      </svg>
    </span>
  );
}

/**
 * The "CHROMIES" crop, used inline wherever the team name appears as a label.
 * It fills with `currentColor` and sizes to the surrounding line, so it sits in
 * running text the way a word would.
 */
export function ChromiesLabel() {
  return (
    <span
      aria-label="Chromies"
      title="Chromies"
      style={css('display:inline-flex;height:.95em;vertical-align:-.12em;color:inherit')}
    >
      <svg
        style={css('height:100%;width:auto;display:block')}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 175 1960 325"
        role="img"
        aria-label="Chromies"
      >
        <path fill="currentColor" fillRule="evenodd" d={WORDMARK_CROP_D} />
      </svg>
    </span>
  );
}
