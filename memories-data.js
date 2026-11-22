// دفتر ذكريات صمصم الخاص

window.DEFAULT_BOOK_DATA = {
  version: 2,
  cover: {
    title: "دفتر ذكريات صمصم",
    subtitle: "كل حاجة تخصك وتفكرك بأحلى أيامك 🌸",
    badge: "Samsam's Personal Diary"
  },
  pages: [
    {
      id: "p1",
      type: "note",
      theme: "blush",
      font: "ruqaa",
      fontSize: "lg",
      title: "كل حاجة تخصك 🌸",
      text: "أهلاً بيكي في مساحتك الخاصة يا صمصم...\nالدفتر ده معمول ليكي إنتي بس، عشان تحفظي فيه صورك الحلوة، لحظاتك المميزة، أغانيكي المفضلة، وكل حاجة تخصك وتفكرك بأيامك الجميلة."
    },
    {
      id: "p2",
      type: "photo-note",
      theme: "rose",
      font: "cairo",
      fontSize: "md",
      title: "لقطة من يوم حلو",
      image: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="360" viewBox="0 0 500 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffb3d1"/><stop offset="100%" stop-color="#ff66a3"/></linearGradient></defs><rect width="500" height="360" fill="url(#g)"/><circle cx="120" cy="100" r="65" fill="rgba(255,255,255,0.22)"/><circle cx="385" cy="265" r="85" fill="rgba(255,255,255,0.18)"/><text x="250" y="170" font-size="48" text-anchor="middle">🌸</text><text x="250" y="220" font-size="22" font-family="Arial" fill="#fff" text-anchor="middle" font-weight="bold">اضيفي صورتك المفضلة هنا</text></svg>`),
      text: "كل صورة بتحفظ لحظة، وده مكانك اللي تجمعي فيه أجمل صورك يا صمصم."
    },
    {
      id: "p3",
      type: "song",
      theme: "midnight",
      font: "marhey",
      fontSize: "lg",
      title: "المود والموسيقى",
      songName: "بلاد النبل",
      image: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#ff62a5"/><text x="100" y="116" font-size="60" text-anchor="middle">🎧</text></svg>`),
      text: "بحبك دايماً"
    },
    {
      id: "p4",
      type: "secret",
      theme: "lavender",
      font: "amiri",
      fontSize: "md",
      title: "رسالة لنفسي",
      text: "افتكري دايماً إنك تستاهلي كل حاجة حلوة يا صمصم 🌸 خدي وقتك، افرحي بتفاصيل يومك الصغيرة، ودايماً خلي ابتسامتك منورة."
    }
  ]
};
