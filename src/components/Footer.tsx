import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router';
import { useTheme, glassSurfaceFilter } from '../theme';
import { BrandShield } from './NavBar';
import { linkEnterActivation } from '../lib/link-activation';

interface FooterLink {
  label: string;
  route?: string;
  url?: string;
  hint?: string;
}

const EXPLORE_LINKS: ReadonlyArray<FooterLink> = [
  { label: 'Home', route: '/', hint: 'Go to the home screen' },
  { label: 'Players', route: '/players', hint: 'Look up player profiles and progression' },
  { label: 'Clans', route: '/clans', hint: 'Search clans and view rosters' },
  { label: 'Compare', route: '/compare', hint: 'Head-to-head comparison' },
  { label: 'Contributors', route: '/contributors', hint: 'View project contributors' },
];

const RESOURCE_LINKS: ReadonlyArray<FooterLink> = [
  {
    label: 'GitHub Repository',
    url: 'https://github.com/The-Clashers/The-Clashers-Hub',
    hint: 'Opens GitHub repository in a new tab',
  },
  {
    label: 'CoC Developer API',
    url: 'https://developer.clashofclans.com',
    hint: 'Official Supercell developer portal',
  },
  {
    label: 'RoyaleAPI Proxy',
    url: 'https://cocproxy.royaleapi.dev',
    hint: 'Community proxy documentation',
  },
  {
    label: 'Design Tokens',
    route: '/tokens',
    hint: 'Review design tokens and system styling',
  },
];

export default function Footer() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();

  const handleLinkPress = (item: FooterLink) => {
    if (item.route) {
      navigate(item.route);
    } else if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <View
      style={styles.footer}
      accessibilityRole="contentinfo"
      accessibilityLabel="Website footer"
    >
      <View style={styles.inner}>
        <View style={styles.columnsRow}>
          {/* Brand info */}
          <View style={styles.brandColumn}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="The Clashers Hub, return to home"
              onPress={() => navigate('/')}
              onKeyDown={linkEnterActivation(() => navigate('/'))}
              style={({ pressed }) => [styles.brandLockup, pressed && styles.brandPressed]}
            >
              <BrandShield color={theme.colors} size={22} />
              <Text style={styles.brandTitle}>The Clashers Hub</Text>
            </Pressable>
            <Text style={styles.brandDescription}>
              Clan and player analytics for Clash of Clans, live and login-free.
              Raw game data turned into actionable verdicts.
            </Text>
            <View style={styles.techPill}>
              <Text style={styles.techPillText}>React Native for Web · TypeScript · Vite</Text>
            </View>
          </View>

          {/* Navigation links */}
          <View style={styles.linkColumn}>
            <Text style={styles.columnHeading}>Explore</Text>
            <View style={styles.linkList}>
              {EXPLORE_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  accessibilityHint={link.hint}
                  onPress={() => handleLinkPress(link)}
                  onKeyDown={linkEnterActivation(() => handleLinkPress(link))}
                  style={({ pressed }) => [styles.linkItem, pressed && styles.linkItemPressed]}
                >
                  <Text style={styles.linkText}>{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Resource links */}
          <View style={styles.linkColumn}>
            <Text style={styles.columnHeading}>Resources</Text>
            <View style={styles.linkList}>
              {RESOURCE_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  accessibilityHint={link.hint}
                  onPress={() => handleLinkPress(link)}
                  onKeyDown={linkEnterActivation(() => handleLinkPress(link))}
                  style={({ pressed }) => [styles.linkItem, pressed && styles.linkItemPressed]}
                >
                  <Text style={styles.linkText}>{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Separator and legal disclaimers */}
        <View style={styles.divider} />

        <View style={styles.legalBlock}>
          <Text style={styles.disclaimerText}>
            This material is unofficial and is not endorsed by Supercell. For more information see
            Supercell&apos;s Fan Content Policy:{' '}
            <Text
              accessibilityRole="link"
              onPress={() =>
                window.open('https://supercell.com/fan-content-policy', '_blank', 'noopener,noreferrer')
              }
              style={styles.legalLink}
            >
              https://supercell.com/fan-content-policy
            </Text>
            .
          </Text>
          <Text style={styles.copyrightText}>
            The Clashers Hub is open source under the MIT License. Clash of Clans and its logos are
            trademarks of Supercell.
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: ReturnType<typeof useTheme>['theme']) {
  const c = t.colors;
  return StyleSheet.create({
    footer: {
      ...glassSurfaceFilter(t),
      borderTopWidth: 1,
      borderTopColor: c.panelBorder,
      borderStyle: 'solid',
      backgroundColor: c.panel,
      marginTop: 'auto',
      paddingTop: t.spacing[6],
      paddingBottom: t.spacing[6],
    },
    inner: {
      width: '100%',
      maxWidth: t.layout.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: t.layout.sidePaddingDesktop,
      gap: t.spacing[5],
    },
    columnsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing[6],
      justifyContent: 'space-between',
    },
    brandColumn: {
      flexGrow: 2,
      flexShrink: 1,
      flexBasis: 280,
      gap: t.spacing[3],
    },
    brandLockup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing[2],
      alignSelf: 'flex-start',
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    brandPressed: {
      opacity: 0.7,
    },
    brandTitle: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.md,
      fontWeight: t.fontWeight.bold,
      color: c.textPrimary,
      letterSpacing: t.letterSpacing.normal,
    },
    brandDescription: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      lineHeight: 18,
      color: c.textSecondary,
      maxWidth: 380,
    },
    techPill: {
      alignSelf: 'flex-start',
      backgroundColor: c.panelRaised,
      paddingHorizontal: t.spacing[2],
      paddingVertical: 3,
      borderRadius: t.radius[1],
      borderWidth: 1,
      borderColor: c.hairline,
    },
    techPillText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      fontWeight: t.fontWeight.medium,
      color: c.textMuted,
    },
    linkColumn: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 140,
      gap: t.spacing[3],
    },
    columnHeading: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold,
      color: c.accentInk,
      textTransform: 'uppercase',
      letterSpacing: t.letterSpacing.micro,
    },
    linkList: {
      gap: t.spacing[2],
    },
    linkItem: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
      outlineColor: c.focusRing,
      outlineOffset: t.layout.focusRingOffset,
    },
    linkItemPressed: {
      opacity: 0.7,
    },
    linkText: {
      fontFamily: t.fontFamily.sans,
      fontSize: t.fontSize.xs,
      color: c.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: c.hairline,
      width: '100%',
    },
    legalBlock: {
      gap: t.spacing[2],
    },
    disclaimerText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      lineHeight: 16,
      color: c.textMuted,
    },
    legalLink: {
      color: c.accentInk,
      textDecorationLine: 'underline',
    },
    copyrightText: {
      fontFamily: t.fontFamily.sans,
      fontSize: 11,
      color: c.textMuted,
    },
  });
}
