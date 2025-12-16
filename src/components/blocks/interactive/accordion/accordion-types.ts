export type AccordionItem = {
  id: string;
  title: string;
  bodyHtml: string; // tiptap html
  isOpenByDefault?: boolean;

  imageUrl?: string; // selected from Media Library
  imageAlt?: string; // optional alt text
};

export type AccordionContent = {
  title?: string; // optional block title above accordion
  instructions?: string; // optional helper text
  items: AccordionItem[];
  settings?: {
    allowMultipleOpen?: boolean; // default false
  };
};
