import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  loadFilterOptionsFromDb,
  type DbFilterOptions,
} from '@/src/db/watchlistRepository';
import type { ListFilterState, ListSortKey } from '@/src/types';
import { countActiveFilters, resetListFilters } from '@/src/utils/listFilters';
import { colors, radius, spacing } from '@/src/theme/colors';

interface Props {
  visible: boolean;
  value: ListFilterState;
  onChange: (next: ListFilterState) => void;
  onClose: () => void;
}

const SORT_OPTIONS: { value: ListSortKey; label: string }[] = [
  { value: 'added', label: 'Datum přidání' },
  { value: 'title', label: 'Název' },
  { value: 'userRating', label: 'Moje hodnocení' },
  { value: 'tmdbRating', label: 'TMDB hodnocení' },
  { value: 'year', label: 'Rok' },
];

const EMPTY_OPTIONS: DbFilterOptions = {
  genres: [],
  collections: [],
  people: [],
};

export function ListFiltersModal({ visible, value, onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);
  const [options, setOptions] = useState<DbFilterOptions>(EMPTY_OPTIONS);
  const [personQuery, setPersonQuery] = useState('');
  const [genreQuery, setGenreQuery] = useState('');
  const active = countActiveFilters(draft);

  const reloadOptions = () => {
    try {
      setOptions(loadFilterOptionsFromDb());
    } catch {
      setOptions(EMPTY_OPTIONS);
    }
  };

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setPersonQuery('');
      setGenreQuery('');
      reloadOptions();
    }
  }, [visible, value]);

  const patch = (partial: Partial<ListFilterState>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const filteredPeople = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    let list = options.people;
    if (draft.personRole === 'cast') {
      list = list.filter((p) => p.roles.includes('cast'));
    } else if (draft.personRole === 'crew') {
      list = list.filter((p) => p.roles.includes('crew'));
    }
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [options.people, personQuery, draft.personRole]);

  const filteredGenres = useMemo(() => {
    const q = genreQuery.trim().toLowerCase();
    if (!q) return options.genres;
    return options.genres.filter((g) => g.name.toLowerCase().includes(q));
  }, [options.genres, genreQuery]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Filtry a řazení</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.section}>Typ</Text>
          <View style={styles.chips}>
            {(
              [
                ['all', 'Vše'],
                ['movie', 'Filmy'],
                ['tv', 'Seriály'],
              ] as const
            ).map(([id, label]) => (
              <Chip
                key={id}
                label={label}
                active={draft.mediaType === id}
                onPress={() => patch({ mediaType: id })}
              />
            ))}
          </View>

          <Text style={styles.section}>Řazení</Text>
          <View style={styles.chips}>
            {SORT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={draft.sort === opt.value}
                onPress={() => patch({ sort: opt.value })}
              />
            ))}
          </View>
          <View style={styles.chips}>
            <Chip
              label={draft.sortAsc ? 'Vzestupně' : 'Sestupně'}
              active
              onPress={() => patch({ sortAsc: !draft.sortAsc })}
            />
          </View>

          <Text style={styles.section}>Moje hodnocení (0.5–10)</Text>
          <RangeRow
            min={draft.minUserRating}
            max={draft.maxUserRating}
            minBound={0.5}
            maxBound={10}
            step={0.5}
            onChangeMin={(v) => patch({ minUserRating: v })}
            onChangeMax={(v) => patch({ maxUserRating: v })}
          />


          <Text style={styles.section}>TMDB hodnocení (1–10)</Text>
          <RangeRow
            min={draft.minTmdbRating}
            max={draft.maxTmdbRating}
            minBound={1}
            maxBound={10}
            step={0.5}
            onChangeMin={(v) => patch({ minTmdbRating: v })}
            onChangeMax={(v) => patch({ maxTmdbRating: v })}
          />

          <Text style={styles.section}>Rok</Text>
          <View style={styles.yearRow}>
            <YearField
              label="Od"
              value={draft.yearFrom}
              onChange={(v) => patch({ yearFrom: v })}
            />
            <Text style={styles.yearDash}>—</Text>
            <YearField
              label="Do"
              value={draft.yearTo}
              onChange={(v) => patch({ yearTo: v })}
            />
            <Pressable
              style={styles.clearBtn}
              onPress={() => patch({ yearFrom: null, yearTo: null })}
            >
              <Text style={styles.clearText}>Vymazat</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Žánr (z databáze)</Text>
          <TextInput
            style={styles.search}
            placeholder="Hledat žánr…"
            placeholderTextColor={colors.textDim}
            value={genreQuery}
            onChangeText={setGenreQuery}
          />
          <View style={styles.chips}>
            <Chip
              label="Vše"
              active={draft.genreId == null}
              onPress={() => patch({ genreId: null })}
            />
            {filteredGenres.map((g) => (
              <Chip
                key={g.id}
                label={g.name}
                active={draft.genreId === g.id}
                onPress={() => patch({ genreId: g.id })}
              />
            ))}
          </View>
          {!options.genres.length ? (
            <Text style={styles.hint}>
              V databázi zatím nejsou žánry. Přidej filmy/seriály — metadata se uloží lokálně.
            </Text>
          ) : null}

          <Text style={styles.section}>Kolekce (z databáze)</Text>
          <View style={styles.chips}>
            <Chip
              label="Vše"
              active={draft.collectionId == null}
              onPress={() => patch({ collectionId: null })}
            />
            {options.collections.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={draft.collectionId === c.id}
                onPress={() => patch({ collectionId: c.id })}
              />
            ))}
          </View>
          {!options.collections.length ? (
            <Text style={styles.hint}>V databázi zatím žádné filmové kolekce.</Text>
          ) : null}

          <Text style={styles.section}>Herec / štáb (z databáze)</Text>
          <View style={styles.chips}>
            {(
              [
                ['any', 'Kdokoliv'],
                ['cast', 'Jen herec'],
                ['crew', 'Jen režie/štáb'],
              ] as const
            ).map(([id, label]) => (
              <Chip
                key={id}
                label={label}
                active={draft.personRole === id}
                onPress={() => patch({ personRole: id })}
              />
            ))}
          </View>
          <TextInput
            style={styles.search}
            placeholder="Hledat jméno…"
            placeholderTextColor={colors.textDim}
            value={personQuery}
            onChangeText={setPersonQuery}
          />
          <View style={styles.chips}>
            <Chip
              label="Všichni"
              active={draft.personId == null}
              onPress={() => patch({ personId: null })}
            />
            {filteredPeople.slice(0, 80).map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                active={draft.personId === p.id}
                onPress={() => patch({ personId: p.id })}
              />
            ))}
          </View>
          {filteredPeople.length > 80 ? (
            <Text style={styles.hint}>Zobrazeno 80 z {filteredPeople.length} — zuž hledání.</Text>
          ) : null}
          {!options.people.length ? (
            <Text style={styles.hint}>
              V databázi zatím nejsou lidé. Po přidání titulů se uloží lokálně.
            </Text>
          ) : null}

          <Text style={styles.section}>Komentář</Text>
          <View style={styles.chips}>
            <Chip
              label="Libovolné"
              active={draft.hasComment == null}
              onPress={() => patch({ hasComment: null })}
            />
            <Chip
              label="S komentářem"
              active={draft.hasComment === true}
              onPress={() => patch({ hasComment: true })}
            />
            <Chip
              label="Bez komentáře"
              active={draft.hasComment === false}
              onPress={() => patch({ hasComment: false })}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.resetBtn}
            onPress={() => setDraft(resetListFilters())}
          >
            <Text style={styles.resetText}>Reset{active ? ` (${active})` : ''}</Text>
          </Pressable>
          <Pressable
            style={styles.applyBtn}
            onPress={() => {
              onChange(draft);
              onClose();
            }}
          >
            <Text style={styles.applyText}>Použít</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RangeRow({
  min,
  max,
  minBound,
  maxBound,
  step,
  onChangeMin,
  onChangeMax,
}: {
  min: number | null;
  max: number | null;
  minBound: number;
  maxBound: number;
  step: number;
  onChangeMin: (v: number | null) => void;
  onChangeMax: (v: number | null) => void;
}) {
  return (
    <View style={styles.rangeBlock}>
      <Stepper
        label="Min"
        value={min}
        minBound={minBound}
        maxBound={max != null ? Math.min(maxBound, max) : maxBound}
        step={step}
        onChange={onChangeMin}
      />
      <Stepper
        label="Max"
        value={max}
        minBound={min != null ? Math.max(minBound, min) : minBound}
        maxBound={maxBound}
        step={step}
        onChange={onChangeMax}
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  minBound,
  maxBound,
  step,
  onChange,
}: {
  label: string;
  value: number | null;
  minBound: number;
  maxBound: number;
  step: number;
  onChange: (v: number | null) => void;
}) {
  const display = value == null ? '—' : String(value);
  const dec = () => {
    if (value == null) {
      onChange(maxBound);
      return;
    }
    const next = Math.round((value - step) * 10) / 10;
    if (next < minBound) onChange(null);
    else onChange(next);
  };
  const inc = () => {
    if (value == null) {
      onChange(minBound);
      return;
    }
    const next = Math.round((value + step) * 10) / 10;
    if (next > maxBound) return;
    onChange(next);
  };

  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={styles.stepBtn} onPress={dec}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.stepperValue}>{display}</Text>
        <Pressable style={styles.stepBtn} onPress={inc}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
      {value != null ? (
        <Pressable onPress={() => onChange(null)}>
          <Text style={styles.clearText}>vymazat</Text>
        </Pressable>
      ) : (
        <Text style={styles.stepperHint}>libovolné</Text>
      )}
    </View>
  );
}

function YearField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={styles.yearField}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <TextInput
        style={styles.yearInput}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="např. 1999"
        placeholderTextColor={colors.textDim}
        value={value == null ? '' : String(value)}
        onChangeText={(text) => {
          const digits = text.replace(/[^\d]/g, '');
          if (!digits) {
            onChange(null);
            return;
          }
          onChange(Number(digits));
        }}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 28,
    color: colors.text,
    letterSpacing: 1,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: 40,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  chipLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textMuted,
  },
  chipLabelActive: {
    color: colors.accent,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textDim,
    lineHeight: 17,
  },
  search: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  rangeBlock: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepper: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  stepperLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: colors.textMuted,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    color: colors.text,
    minWidth: 36,
    textAlign: 'center',
  },
  stepperHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textDim,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  yearField: {
    flex: 1,
    gap: 6,
  },
  yearInput: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
  },
  yearDash: {
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textDim,
    marginBottom: 12,
  },
  clearBtn: {
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  clearText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
  },
  resetText: {
    fontFamily: 'DMSans_600SemiBold',
    color: colors.textMuted,
  },
  applyBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  applyText: {
    fontFamily: 'DMSans_700Bold',
    color: colors.bg,
  },
});
