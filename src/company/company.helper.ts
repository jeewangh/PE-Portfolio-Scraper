import { CompanyInterface, NewCompany } from '../types/scrapper/kkr/company-data-model.i';
import { MergeUtils } from '../utils/merge.utils';
import { ScrappedCompany } from '../types/scrapper/kkr/scrapper-api.response';

export class CompanyHelper {
  static mergeCompanyData(
    existing: CompanyInterface,
    incoming: NewCompany | undefined,
  ): CompanyInterface {
    const base = { ...existing };

    const merged = MergeUtils.merge<NewCompany>(base, incoming);

    merged.general.relevantLinks = MergeUtils.mergeUnique(
      merged.general.relevantLinks,
      incoming?.general?.relevantLinks,
    ).value;

    merged.ownership = {
      ...merged.ownership,
      operatingRegion: MergeUtils.mergeUnique(
        merged.ownership?.operatingRegion,
        incoming?.ownership?.operatingRegion,
      ).value,
      assetClasses: MergeUtils.mergeUnique(
        merged.ownership?.assetClasses,
        incoming?.ownership?.assetClasses,
      ).value,
    };

    merged.general.executiveMembers = MergeUtils.mergeUnique(
      merged.general.executiveMembers,
      incoming?.general?.executiveMembers,
    ).value;

    return merged as CompanyInterface;
  }

  static mergeScrapedCompanyData(
    existing: Partial<ScrappedCompany>,
    incoming: Partial<ScrappedCompany> | undefined,
  ): Partial<ScrappedCompany> {
    if (!incoming) return existing;

    const merged = MergeUtils.merge<Partial<ScrappedCompany>>(existing, incoming);

    if (incoming?.relatedLinks?.length) {
      merged.relatedLinks = MergeUtils.mergeArrays(merged.relatedLinks, incoming.relatedLinks);
    }
    if (incoming?.executiveMembers?.length) {
      merged.executiveMembers = MergeUtils.mergeArrays(
        merged.executiveMembers,
        incoming.executiveMembers,
      );
    }

    return merged;
  }
}
