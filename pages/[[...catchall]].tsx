import * as React from "react";
import {
  PlasmicComponent,
  extractPlasmicQueryData,
  ComponentRenderData,
  PlasmicRootProvider,
} from "@plasmicapp/loader-nextjs";
import type { GetStaticPaths, GetStaticProps } from "next";

import Error from "next/error";
import { useRouter } from "next/router";
import { PLASMIC } from "@/plasmic-init";

export default function PlasmicLoaderPage(props: {
  pagePath: string,
  bannerName: string | null,
  plasmicData?: ComponentRenderData;
  queryCache?: Record<string, unknown>;
}) {
  const { pagePath, bannerName, plasmicData, queryCache } = props;
  const router = useRouter();
  if (!plasmicData || plasmicData.entryCompMetas.length === 0) {
    return <Error statusCode={404} />;
  }
  const pageMeta = plasmicData.entryCompMetas[0];
  return (
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData}
      prefetchedQueryData={queryCache}
      pageRoute={pageMeta.path}
      pageParams={pageMeta.params}
      pageQuery={router.query}
    >
      { bannerName && <PlasmicComponent component={bannerName} /> }
      <PlasmicComponent component={pagePath} />
    </PlasmicRootProvider>
  );
}

export const getStaticProps: GetStaticProps = async (context) => {
  const { catchall } = context.params ?? {};
  const plasmicPathArray = typeof catchall === "undefined"
    ? []
    : typeof catchall === 'string'
      ? [catchall]
      : catchall;
  const lastPath = plasmicPathArray[plasmicPathArray.length - 1];
  const bannerName = lastPath.toLowerCase().startsWith("banner") ? lastPath : null;
  const pagePathArray = bannerName ? plasmicPathArray.slice(0, plasmicPathArray.length - 1) : plasmicPathArray;
  const pagePath = `/${pagePathArray.join('/')}`;
  const plasmicSpecs: string[] = [pagePath];
  if (bannerName) {
    plasmicSpecs.push(bannerName);
  }
  const plasmicData = await PLASMIC.maybeFetchComponentData(plasmicSpecs);
  if (!plasmicData) {
    // non-Plasmic catch-all
    return { props: {} };
  }
  // Cache the necessary data fetched for the page
  const queryCache = await extractPlasmicQueryData(
    <PlasmicLoaderPage pagePath={pagePath} bannerName={bannerName} />
  );
  // Use revalidate if you want incremental static regeneration
  return {
    props: {
      pagePath,
      bannerName,
      plasmicData,
      queryCache
    },
    revalidate: 60
  };
}

export const getStaticPaths: GetStaticPaths = async () => {
  const pageModules = await PLASMIC.fetchPages();
  const bannerComps = (await PLASMIC.fetchComponents())
    .filter(comp => comp.displayName.toLowerCase().startsWith("banner"));

  const paths: { params: { catchall: string[] } }[] = [];
  for (const pageModule of pageModules) {
    const path = pageModule.path === "/" ? [] : pageModule.path.substring(1).split("/");
    for (const bannerComp of bannerComps) {
      paths.push({
        params: {
          catchall: [...path, bannerComp.displayName]
        }
      });
    }
  }
  //console.log("getStaticPaths", JSON.stringify(paths, null, 2));

  return {
    paths,
    fallback: "blocking",
  };
}
