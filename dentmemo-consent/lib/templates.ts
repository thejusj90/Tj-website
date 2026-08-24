export type ConsentTemplate = {
  slug: string;
  procedure: string;
  title: string;
  body: string;
  acknowledgements: string[];
};

const commonAcks = [
  "I have read and understood the information above.",
  "I have had an opportunity to ask questions.",
  "I understand that outcomes cannot be guaranteed.",
];

export const consentTemplates: ConsentTemplate[] = [
  {
    slug: "root-canal",
    procedure: "Root Canal Treatment",
    title: "Consent for Root Canal Treatment",
    body:
      "The reason for root canal treatment, the nature of the procedure, expected benefits, reasonable alternatives and material risks have been explained to me. I understand that treatment may require more than one visit and that a final restoration or crown may be recommended after the root canal. I understand that discomfort, swelling, instrument separation, persistent infection, fracture, perforation, the need for retreatment or surgery, and eventual loss of the tooth are possible even with appropriate care.",
    acknowledgements: commonAcks,
  },
  {
    slug: "extraction",
    procedure: "Tooth Extraction",
    title: "Consent for Tooth Extraction",
    body:
      "The reason for extraction and reasonable alternatives have been explained to me. I understand that risks can include pain, swelling, bleeding, infection, delayed healing, dry socket, damage to adjacent teeth or restorations, sinus involvement, altered sensation or numbness, and the possible need for additional treatment. I understand the importance of following post-operative instructions.",
    acknowledgements: commonAcks,
  },
  {
    slug: "implant",
    procedure: "Dental Implant",
    title: "Consent for Dental Implant Treatment",
    body:
      "The purpose and stages of dental implant treatment, alternatives, expected benefits and material risks have been explained to me. I understand that implant treatment may involve surgery and healing time, and that success depends on bone, gum health, hygiene and other biological factors. I understand risks may include infection, implant failure, bone loss, injury to nearby structures, altered sensation, sinus involvement and the need for further treatment.",
    acknowledgements: commonAcks,
  },
  {
    slug: "crown-bridge",
    procedure: "Crown / Bridge",
    title: "Consent for Crown / Bridge Treatment",
    body:
      "The reason for the proposed crown or bridge, the preparation required and reasonable alternatives have been explained to me. I understand that tooth preparation is irreversible and that temporary sensitivity, pulp irritation, the need for root canal treatment, fracture, loss of retention, gum irritation, shade limitations and the future need for repair or replacement may occur.",
    acknowledgements: commonAcks,
  },
  {
    slug: "restoration",
    procedure: "Filling / Restoration",
    title: "Consent for Dental Restoration",
    body:
      "The reason for the proposed filling or restoration and reasonable alternatives have been explained to me. I understand that sensitivity, discomfort, bite adjustment, fracture, recurrent decay, pulp irritation and the future need for root canal treatment, crown or replacement restoration may occur depending on the condition of the tooth.",
    acknowledgements: commonAcks,
  },
  {
    slug: "scaling",
    procedure: "Scaling / Cleaning",
    title: "Consent for Scaling / Dental Cleaning",
    body:
      "The purpose of scaling and dental cleaning has been explained to me. I understand that temporary sensitivity, gum bleeding, soreness and the exposure of spaces or root surfaces previously covered by deposits or inflamed tissue may occur. I understand that periodontal disease may require further treatment and maintenance.",
    acknowledgements: commonAcks,
  },
  {
    slug: "orthodontics",
    procedure: "Orthodontic Treatment",
    title: "Consent for Orthodontic Treatment",
    body:
      "The goals, expected duration, alternatives and limitations of orthodontic treatment have been explained to me. I understand that treatment depends on attendance, appliance care and oral hygiene. Risks can include discomfort, tooth decay, gum problems, root shortening, relapse, appliance breakage and the need for additional dental or surgical treatment.",
    acknowledgements: commonAcks,
  },
  {
    slug: "media",
    procedure: "Dental Photography / Media",
    title: "Dental Photography / Media Consent",
    body:
      "The purpose and intended use of dental photographs or related media have been explained to me. I understand what information may be captured and the clinic has explained whether the media is intended for clinical records, education or another approved purpose. I have had an opportunity to ask questions before giving this consent.",
    acknowledgements: [
      "I have read and understood the information above.",
      "I have had an opportunity to ask questions.",
    ],
  },
];

export function getTemplate(slug: string) {
  return consentTemplates.find((t) => t.slug === slug) ?? consentTemplates[0];
}
