// The pets a person can choose and what they say.
export const PETS = {
  cat: {
    name: "Cookie",
    label: "Gatito",
    color: "#c98b5b",
    motto: "Miau. Aquí estoy para cuidar tus sueños.",
    // Only for whoever receives Cookie as a gift from their partner.
    special: true,
  },
  pig: {
    name: "Pipo",
    label: "Cerdito",
    color: "#f3c8ce",
    motto: "Un guardadito y un abrazo.",
  },
  cow: {
    name: "Mila",
    label: "Vaquita",
    color: "#d9d5ef",
    motto: "Vamos a tu ritmo, muuuy bien.",
  },
  dog: {
    name: "Taro",
    label: "Shiba",
    color: "#ffb36b",
    motto: "Meneo la cola por cada pasito.",
  },
  otter: {
    name: "Nuri",
    label: "Nutria",
    color: "#c99467",
    motto: "Guardo mi piedrita, y tú tus sueños.",
  },
  bunny: {
    name: "Luna",
    label: "Conejito",
    color: "#eedec7",
    motto: "Pasito a pasito, saltito a saltito.",
  },
  box: {
    name: "Caji",
    label: "Cajita",
    color: "#c8e8bd",
    motto: "Los sueños también necesitan una casita.",
  },
};
/** What a special pet says when nobody personalized it. */
export const PET_WORDS = {
  lines: ["¡Miau!", "Miau miau"],
  loveText: "¡Te quiero mucho!",
};
/** Pets this person can choose: special ones only once they were given. */
export function availablePets(preferences) {
  const given = preferences?.special?.pets ?? [];
  return Object.keys(PETS).filter(
    (key) =>
      !PETS[key].special || given.includes(key) || preferences?.pet === key,
  );
}
/** Words of the current pet: the partner's, or the default ones. */
export function petWords(preferences) {
  const special = preferences?.special;
  return {
    lines: special?.lines?.length ? special.lines : PET_WORDS.lines,
    loveText: special?.loveText || PET_WORDS.loveText,
    motto: special?.motto || PETS[preferences?.pet]?.motto || "",
    from: special?.from || "",
  };
}
