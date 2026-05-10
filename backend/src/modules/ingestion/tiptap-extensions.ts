/**
 * Shared TipTap extensions configuration for server-side HTML↔JSON conversion.
 * Used by TipTapConverterService and ConversionWorker.
 */
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

export const SERVER_EXTENSIONS = [
  StarterKit,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  Image,
  Link,
];
