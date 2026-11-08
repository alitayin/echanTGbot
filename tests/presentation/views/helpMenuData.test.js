import { describe, expect, it } from 'vitest';
import { getHelpMenu } from '../../../src/presentation/views/helpMenuData.js';

describe('getHelpMenu', () => {
    it('exposes the registered Avalanche command from the user menu', () => {
        const mainMenu = getHelpMenu('help_main', false);
        const avaMenu = getHelpMenu('cmd_ava', false);

        expect(mainMenu.keyboard.flat().some(button => button.callback_data === 'cmd_ava')).toBe(true);
        expect(avaMenu.text).toContain('<b>/ava</b>');
    });

    it('returns null for missing and non-string callback values', () => {
        expect(getHelpMenu(undefined, false)).toBeNull();
        expect(getHelpMenu(null, false)).toBeNull();
    });
});
