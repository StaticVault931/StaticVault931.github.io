const PATHS = {
  like: {
    outline: 'M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.02-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2zm0-12 4.34-4.34L12 10h9v2l-3 7H9V9zM1 9h4v12H1z',
    filled: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.02-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73z',
  },
  dislike: {
    outline: 'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.02.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm0 12-4.34 4.34L12 14H3v-2l3-7h9v10zm4-12h4v12h-4V3z',
    filled: 'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.02.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z',
  },
  love: {
    outline: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.76 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.26 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
    filled: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.26 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.76-3.4 6.86-8.55 11.54L12 21.35z',
  },
};

export function reactionIcon(kind, active = false, className = '') {
  const paths = PATHS[kind] || PATHS.like;
  const state = active ? 'filled' : 'outline';
  return `<svg class="reaction-icon${className ? ` ${className}` : ''}" data-reaction-icon="${kind}" data-icon-state="${state}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${paths[state]}"></path></svg>`;
}

export function setReactionIcon(target, kind, active = false) {
  if (!target) return;
  const icon = target.matches?.('[data-reaction-icon], .material-icons-round')
    ? target
    : target.querySelector?.('[data-reaction-icon], .material-icons-round');
  if (!icon) return;
  icon.outerHTML = reactionIcon(kind, active);
}
